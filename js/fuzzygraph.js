// fuzzygraph.js
// Logic to draw fuzzy graphs on a canvas

function drawGraph(canvasElement) {
  //const canvasWidth = canvasElement.width;
  //const canvasHeight = canvasElement.height;
  const canvasWidth = canvasElement.clientWidth;
  const canvasHeight = canvasElement.clientHeight;
  const ctx = canvasElement.getContext('2d');
  //const canvasWidth = ctx.canvas.width;
  //const canvasHeight = ctx.canvas.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle='gray';
  ctx.fillRect(0, 0, canvas.width, canvas.height); 

  // Set text properties
  ctx.font = '20px Arial'; // Font size and family
  ctx.fillStyle = 'black'; // Text color
  ctx.textAlign = 'center'; // Text alignment (optional)
  ctx.fillText(`size = (${canvas.width}, ${canvas.height}), clientSize = (${canvasWidth}, ${canvasHeight})`, canvasWidth / 2, canvasHeight / 2);

  ctx.fillStyle = 'blue';
  ctx.beginPath();
  ctx.arc(100, 100, 100, 0, 2 * Math.PI); // (x, y, radius, startAngle, endAngle)
  ctx.fill();

  ctx.fillStyle = 'green';
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, 2 * Math.PI); // (x, y, radius, startAngle, endAngle)
  ctx.fill();

  ctx.fillStyle = 'magenta';
  ctx.beginPath();
  ctx.arc(canvasWidth, canvasHeight, 10, 0, 2 * Math.PI); // (x, y, radius, startAngle, endAngle)
  ctx.fill();

  // Center
  ctx.fillStyle = 'red';
  ctx.beginPath();
  ctx.arc(canvasWidth/2, 100+canvasHeight/2, 50, 0, 2 * Math.PI); // (x, y, radius, startAngle, endAngle)
  ctx.fill();
}


