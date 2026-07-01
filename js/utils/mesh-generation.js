export function subdividedPlaneMesh(height, width){
  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const startX = -(width / 2) - 1;
  const startZ = -(height / 2) - 1;

  const fixedParticles = [0, 10, 110, 120];

  let attributeIndex = 0;
  let length = 0;

  // filling vertices first
  for(let row = 0; row < width + 1; row++) {  //there's 1 more vertices in a row than edges
    for(let column = 0; column < height + 1; column++) { // same for column
      positions.push(startX + column, 0, startZ + row);
      colors.push(
        (Math.sin((row+column)*7)/2 + 0.5),
        (Math.sin((row+column)*9)/5),
        (9*Math.cos((row+column)/9)/3),
        1
      );
      uvs.push(1, 1);
      length++;
    }
  }

  let row_offset = width + 1;
  // now filling indices from row and column
  for(let row = 0; row < width; row++) {
    for(let column = 0; column < height; column++) {

      attributeIndex = column + (row * (width + 1)); // adding a bigger offset since width of vert array is bigger by 1
      indices.push(
        attributeIndex, attributeIndex + 1, attributeIndex + row_offset + 1,
        attributeIndex, attributeIndex + row_offset, attributeIndex + row_offset + 1,
      );
    }
  }

  return {
    positions,
    colors,
    uvs,
    indices,
    fixedParticles,
    length
  };
}
