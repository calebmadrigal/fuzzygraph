// fuzzygraph.js
// Logic to draw fuzzy graphs on a canvas

ZOOM_RATE = 1.2;
MAX_FUZZY = 200;

// // // // // // // Math stuff

function makeLinearMapper(inRange, outRange, intOut) {
  var inDelta = inRange[1] - inRange[0];
  var outDelta = outRange[1] - outRange[0];
  // y = mx + b (m = slope, b = y-intersect)
  var m = (outDelta / inDelta);
  // To find b: b = y - mx
  // Just plug in first item of each range
  var b = outRange[0] - m * inRange[0];

  if (intOut) {
    var linearMapper = function(val) {
      return Math.round(m * val + b);
    }
  }
  else {
    var linearMapper = function(val) {
      return m * val + b;
    }
  }

  return linearMapper;
}

function parseEquationString(eq_str) {
  var split_result = eq_str.split("=");
  if (split_result.length != 2) {
    return null;
  }

  try {
    var left_eq = math.evaluate('f(x, y) = ' + split_result[0], {});
    var right_eq = math.evaluate('f(x, y) = ' + split_result[1], {});

    // Call the function for each side of the equation to see if either throws an exception.
    // No need to render the graph (which won't happen if we return null) we can't calculate anything
    left_eq(0.01, 0.01);
    right_eq(0.01, 0.01);
  } catch (error) {
    return null;
  }
  var error_func = function (x, y) { return Math.abs(left_eq(x, y) - right_eq(x, y)); };

  return error_func;
}

function getXMin(xWidth, xCenter) {
  return -1 * xWidth / 2 + xCenter;
}

function getXMax(xWidth, xCenter) {
  return xWidth / 2 + xCenter;
}

function getYMin(yHeight, yCenter) {
  return -1 * yHeight / 2 + yCenter;
}

function getYMax(yHeight, yCenter) {
  return yHeight / 2 + yCenter;
}

function getHeightToWidthMultiplier(xWidth, yHeight) {
  return xWidth / yHeight;
}

function getXWidth(yHeight, canvasWidth, canvasHeight) {
  return yHeight * getHeightToWidthMultiplier(canvasWidth, canvasHeight);
}

function calcWindowBounds(xCenter, yCenter, yHeight, canvasWidth, canvasHeight) {
  // Calculate xWidth based on yHeight
  var xWidth = getXWidth(yHeight, canvasWidth, canvasHeight);

  // Calculate x and y min and max based on window size and center
  return {
    'xMin': getXMin(xWidth, xCenter),
    'xMax': getXMax(xWidth, xCenter),
    'yMin': getYMin(yHeight, yCenter),
    'yMax': getYMax(yHeight, yCenter)
  };
}

function calculateFuncForWindow(func, window, canvasWidth, canvasHeight) {
  var pixel_to_x_mapper = makeLinearMapper([0, canvasWidth], [window['xMin'], window['xMax']], false);
  var pixel_to_y_mapper = makeLinearMapper([canvasHeight, 0], [window['yMin'], window['yMax']], false);

  var minValue = 9999999;
  var maxValue = -9999999;
  var maxCutoff = 100;
  console.log(`calculateFuncForWindow() - canvasWidth = ${canvasWidth}, canvasHeight = ${canvasHeight}`);
  var pixelValues = new Array(canvasWidth * canvasHeight);

  // Calculate values for each pixel, and find the min and max values
  for (var pixelX = 0; pixelX < canvasWidth; pixelX++) {
    for (var pixelY = 0; pixelY < canvasHeight; pixelY++) {
      var x = pixel_to_x_mapper(pixelX);
      var y = pixel_to_y_mapper(pixelY);
      var result = func(x, y);
      result = Math.min(result, maxCutoff);
      if (result > maxValue) {
        maxValue = result;
      }
      if (result < minValue) {
        minValue = result;
      }

      pixelValues[(pixelY * canvasWidth) + pixelX] = result;
    }
  }

  return {'pixelValues': pixelValues, 'max': maxValue, 'min': minValue};
}


// // // // // // // Display Graph

function makeColorMapper(minInput, maxInput) {
    var colorChannelRange = [0, 255];
    var colorMapper = makeLinearMapper([minInput, maxInput], colorChannelRange, true);

    var mapper = function(val) {
        var colorVal = colorMapper(val);
        return [colorVal, colorVal, 100];
    };

    return mapper;
}

function drawAxes(canvasContext) {
  // Grid settings
  const gridSize = 50; // Grid cell size in pixels
  const axisColor = '#000000';
  const gridColor = '#e0e0e0';
  const labelOffset = 15; // Offset for axis labels

  // Draw grid
  ctx.beginPath();
  ctx.strokeStyle = gridColor;

  // Vertical grid lines
  for (let x = 0; x <= width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
  }

  // Horizontal grid lines
  for (let y = 0; y <= height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
  }
  ctx.stroke();

  // Draw axes
  ctx.beginPath();
  ctx.strokeStyle = axisColor;
  ctx.lineWidth = 2;

  // X-axis
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);

  // Y-axis
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();

  // Draw axis labels
  ctx.font = '12px Arial';
  ctx.fillStyle = axisColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // X-axis labels
  for (let x = 0; x <= width; x += gridSize) {
      const value = (x - width / 2) / gridSize; // Convert pixel to coordinate
      if (value !== 0) { // Skip origin
          ctx.fillText(value, x, height / 2 + labelOffset);
      }
  }

  // Y-axis labels
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let y = 0; y <= height; y += gridSize) {
      const value = (height / 2 - y) / gridSize; // Convert pixel to coordinate
      if (value !== 0) { // Skip origin
          ctx.fillText(value, width / 2 - labelOffset, y);
      }
  }

}

function displayFuzzyGraph(pixelValues, minValue, maxValue, fuzzyValue, canvasElem) {
  var context = canvasElem.getContext('2d');
  var canvasWidth = context.canvas.width;
  var canvasHeight = context.canvas.height;
  var imageData = context.createImageData(canvasWidth, canvasHeight);
  var pixelData = imageData.data;

  console.log(`displayFuzzyGraph() - minValue = ${minValue}, maxValue = ${maxValue}, fuzzyValue = ${fuzzyValue}`);

  // Function to modify the value to make the graph look more interesting
  // We do this because the value is a measure of error, but we want more error
  // to look like a more intense value on the graph
  var valueModifier = function (value) {
    return Math.pow(maxValue - value, MAX_FUZZY - fuzzyValue);
  };

  // Determine the color scale based on the min and max values
  var colorMapper = makeColorMapper(valueModifier(maxValue), valueModifier(minValue));

  // Set the color for each pixel based on the values
  for (var x = 0; x < canvasWidth; x++) {
    for (var y = 0; y < canvasHeight; y++) {
      var value = pixelValues[y * canvasWidth + x];
      var color = colorMapper(valueModifier(value));

      // Set pixel color channels
      var pixelOffset = (canvasWidth * y + x) * 4;
      pixelData[pixelOffset] = color[0];     // red
      pixelData[pixelOffset + 1] = color[1]; // green
      pixelData[pixelOffset + 2] = color[2]; // blue
      pixelData[pixelOffset + 3] = 255;      // alpha
    }
  }

  context.putImageData(imageData, 0, 0);
}

function displayGraph(graphParams, canvasElem) {
  console.log('~~~~ displayGraph ~~~');
  console.log(graphParams);
  const canvasWidth = canvasElem.width;
  const canvasHeight = canvasElem.height;
  var window = calcWindowBounds(graphParams['xCenter'],
      graphParams['yCenter'],
      graphParams['yHeight'],
      canvasWidth,
      canvasHeight);

  const t1 = performance.now();
  var pixelValues = calculateFuncForWindow(graphParams['equationFunction'],
      window,
      canvasWidth,
      canvasHeight);
  const t2 = performance.now();

  displayFuzzyGraph(pixelValues['pixelValues'],
      pixelValues['min'],
      pixelValues['max'],
      graphParams['fuzzyLevel'],
      canvasElem);

  //if (graphParams['showAxes']) {
    //var context = canvasElem.getContext('2d');
    //drawAxes(context);
    //console.log('drawAxes TODO')
  //}

  const t3 = performance.now();

  const elapsed1 = t2-t1;
  const elapsed2 = t3-t2;

  console.log(`displayGraph() metrics - calculateFuncForWindow_time = ${elapsed1}, displayFuzzyGraph_time = ${elapsed2}`);
}


// // // // // // // TEST STUFF

function drawGraphCalibration(canvasElement, graphConfig) {
  console.log('drawGraph()');
  console.log(graphConfig);
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


