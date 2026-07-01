import {Camera} from "./entities/camera.js";
import {Mesh} from "./entities/mesh.js";

import {packMesh, getAlignments} from "./utils/buffer.js";
import {getTranspose, getInverse, trimMatrix, multiplyMatrix} from "./utils/vector.js";
import {subdividedPlaneMesh} from "./utils/mesh-generation.js";


const presentationFormat = 'rgba8unorm';

export class GpuEngine {
  #canvas;
  #context;
  #adapter;
  #device;
  #meshes = new Map();
  #pipelines = new Map();
  #cameras = new Map();

  // Initialize physics parameters
  dt = 1.0 / 60.0;
  steps = 10;
  sdt = this.dt / this.steps;
  gravity = new Float32Array([0.0, -9.8, 0.0]);

  centerVert = 60;
  centerYPos = 0;

  gravityActive = true;


  constructor(options) {
  this.#canvas = options.canvas;
  this.#context = options.canvas.getContext("webgpu");

  }

  cameras() {
    return this.#cameras;
  }

  toggleGravity() {
    this.gravityActive = !this.gravityActive;
  }

  async initialize() {
    this.#adapter = await navigator.gpu.requestAdapter();
    this.#device = await this.#adapter.requestDevice();
    this.#context.configure({
      device: this.#device,
      format: presentationFormat
    });
    this.initializeCameras();
    this.initializeMeshes();
    this.initializePipelines();
  }

  initializeCameras(){
    this.#cameras.set("main", new Camera({
      position: [4, 5, 9],
      target: [0, 0, 0],
      screenHeight: this.#canvas.height,
      screenWidth: this.#canvas.width,
      fieldOfView: 90,
      near: 0.01,
      far: 60,
      isPerspective: true
    }))
  }

  initializeMeshes() {
    const mesh = new Mesh(
      subdividedPlaneMesh(10, 10)
    );
    mesh.createDistanceConstraint(0.0);
    const vertices = packMesh(mesh, {positions: 3, uvs: 2, colors: 4});

    const vertexBuffer = this.#device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.#device.queue.writeBuffer(vertexBuffer, 0, vertices);

    const indexBuffer = this.#device.createBuffer({
      size: mesh.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    this.#device.queue.writeBuffer(indexBuffer, 0, mesh.indices);

    this.#meshes.set("main", {
      vertexBuffer,
      indexBuffer,
      mesh
    });
  }

  initializePipelines() {
    const vertexBufferDescriptor = [{
      attributes: [
        {
          shaderLocation: 0,
          offset: 0,
          format: "float32x3"
        },
        {
          shaderLocation: 1,
          offset: 12,
          format: "float32x4"
        },
        {
          shaderLocation: 2,
          offset: 28,
          format: "float32x2"
        },
     ],
      arrayStride: 36,
      stepMode: "vertex"
    }];

    const shaderModule = this.#device.createShaderModule({
      label:"shader-main",
      code: `
        struct VertexOut {
            @builtin(position) position: vec4f,
            @location(0) color: vec4f,
            @location(1) uv: vec2f,
        };

        struct Environment {
          view_matrix: mat4x4<f32>,
          projection_matrix: mat4x4<f32>,
          model_matrix: mat4x4<f32>,
          normal_matrix: mat3x3<f32>,
          camera_Position: vec3f,
        };

        @group(0) @binding(0) var<uniform> environment : Environment;

        @vertex
        fn vertex_main(
          @location(0) position: vec3f,
          @location(1) color: vec4f,
          @location(2) uv: vec2f
        ) -> VertexOut

        {
            var output : VertexOut;
            output.position = environment.projection_matrix * environment.view_matrix * environment.model_matrix * vec4f(position, 1.0);
            output.uv = uv;
            output.color = color;
            return output;
        }

        @fragment
        fn fragment_main(fragData: VertexOut) -> @location(0) vec4f
        {
            return fragData.color;
        }
      `
      });

    const environmentBindGroupLayout = this.#device.createBindGroupLayout({
      label: "main-environment-bind-group-layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {
            type: "uniform"
          }
        }
      ]
    })

    const pipelineLayout = this.#device.createPipelineLayout({
      label: "main-pipeline=layout",
      bindGroupLayouts: [
        environmentBindGroupLayout
      ]
    });

    const pipelineDescriptor = {
      label: "pipeline",
      vertex: {
       module: shaderModule,
       entryPoint: "vertex_main",
       buffers: vertexBufferDescriptor,
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fragment_main",
        targets: [
          { format: presentationFormat }
        ]
      },
      primitive: {
        topology: "triangle-list"
      },
      layout: pipelineLayout
    };

    this.#pipelines.set("main", {
      pipeline: this.#device.createRenderPipeline(pipelineDescriptor),
      pipelineLayout,
      bindGroupLayouts: [
        environmentBindGroupLayout
      ]
    });
  }

  start() {
    this.renderLoop();
  }

    renderLoop() {
      requestAnimationFrame((timestamp) => {
        this.render(timestamp);
        this.renderLoop();
      });
    }

  setBindGroups(passEncoder, bindGroupLayouts, camera, mesh){
    const viewMatrix = camera.getViewMatrix();
    const projectionMatrix = camera.getProjectionMatrix();
    const modelMatrix = mesh.getModelMatrix();
    const normalMatrix = getTranspose(getInverse(trimMatrix(multiplyMatrix(modelMatrix, [4,4], viewMatrix, [4,4]), [4,4], [3,3]), [3,3]), [3,3]);
    const cameraPosition = camera.getPosition();

    const alignment = getAlignments([
      "mat4x4f32",
      "mat4x4f32",
      "mat4x4f32",
      "mat3x3f32",
      "vec3f32"
    ]);

    const bufferSize = alignment.totalSize;

    const environmentUniformBuffer = this.#device.createBuffer({
      size: bufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: "environment-uniform-buffer"
    });
    const environmentUniformData = new Float32Array(bufferSize / 4);
    environmentUniformData.set(viewMatrix, alignment.offsets[0] / 4);
    environmentUniformData.set(projectionMatrix, alignment.offsets[1] / 4);
    environmentUniformData.set(modelMatrix, alignment.offsets[2] / 4);
    environmentUniformData.set(normalMatrix, alignment.offsets[3] / 4);
    environmentUniformData.set(cameraPosition, alignment.offsets[4]/ 4);

    this.#device.queue.writeBuffer(environmentUniformBuffer, 0, environmentUniformData);

    const environmentBindGroup = this.#device.createBindGroup({
      label: "environment-bind-group",
      layout: bindGroupLayouts[0],
      entries: [
        {
          binding: 0,
          resource: {
            buffer: environmentUniformBuffer,
            offset: 0,
            size: bufferSize
          }
        }
      ]
    });

    passEncoder.setBindGroup(0, environmentBindGroup);
  }

  render() {

    const commandEncoder = this.#device.createCommandEncoder({label: "main-command-encoder"});
    const clearColor = { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };

    const camera = this.#cameras.get("main");
    const pipelineContainer = this.#pipelines.get("main");
    const meshContainer = this.#meshes.get("main");

    const renderPassDescriptor = {
      label: "main-render-pass",
      colorAttachments: [
        {
          loadValue: clearColor,
          storeOp: "store",
          loadOp: "load",
          view: this.#context.getCurrentTexture().createView()
        }
      ]
    };

    // mesh manipulation and solving
    this.centerYPos = Math.sin(Date.now() / 2000);
    for (let i = 0; i < this.steps; i++) {
      meshContainer.mesh.preSolve(this.sdt, this.gravityActive ? this.gravity : [0, 0, 0]);
      meshContainer.mesh.solve(this.sdt);
      meshContainer.mesh.postSolve(this.sdt);
      meshContainer.mesh.positions[this.centerVert * 3 +1] = this.centerYPos;
    }

    const vertices = packMesh(meshContainer.mesh, {positions: 3, uvs: 2, colors: 4});

    this.#device.queue.writeBuffer(meshContainer.vertexBuffer, 0, vertices);

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

    this.setBindGroups(passEncoder, pipelineContainer.bindGroupLayouts, camera, meshContainer.mesh);
    passEncoder.setPipeline(pipelineContainer.pipeline);
    passEncoder.setVertexBuffer(0, meshContainer.vertexBuffer);
    passEncoder.setIndexBuffer(meshContainer.indexBuffer, "uint16");



    passEncoder.drawIndexed(meshContainer.mesh.indices.length);
    passEncoder.end();

    this.#device.queue.submit([commandEncoder.finish()]);
    }
}
