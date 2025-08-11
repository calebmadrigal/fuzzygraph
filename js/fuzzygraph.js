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


//////// START AXES STUFF

function drawAxes(canvas, xCenter, yCenter, xMin, xMax, yMin, yMax) {
  // NOTE: This function written by ChatGPT 5 and modified by Caleb.
  const ctx = canvas.getContext('2d');

  // HiDPI handling (keeps result crisp if CSS size differs from width/height)
  const dpr = window.devicePixelRatio || 1;
  if (canvas._backingStore !== dpr) {
    canvas._backingStore = dpr;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  }

  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1,0,0,1,0,0);

  const spanX = Math.max(1e-12, xMax - xMin);
  const spanY = Math.max(1e-12, yMax - yMin);

  const scale = Math.min(W / spanX, H / spanY); // px per world unit (same on both axes)

  const showSpanX = W / scale;
  const showSpanY = H / scale;

  const vxMin = xCenter - showSpanX/2, vxMax = xCenter + showSpanX/2;
  const vyMin = yCenter - showSpanY/2, vyMax = yCenter + showSpanY/2;

  const toCX = x => (x - xCenter) * scale + W/2;
  const toCY = y => H/2 - (y - yCenter) * scale;

  // Nice step (…, 0.1, 0.2, 0.5, 1, 2, 5, 10, …)
  function niceStep(raw) {
    const pow10 = 10 ** Math.floor(Math.log10(raw));
    const f = raw / pow10;
    const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
    return nf * pow10;
  }
  function fmtLabel(v, step) {
    const dec = Math.max(0, -Math.floor(Math.log10(step)));
    const s = v.toFixed(Math.min(10, dec));
    return Math.abs(+s) < 1e-12 ? '0' : s;
  }

  // Choose tick step from target pixel spacing
  const targetPx = 80 * dpr;
  const step = niceStep(targetPx / scale); // SAME step for both axes

  // Grid ticks
  const firstX = Math.ceil(vxMin / step) * step;
  const firstY = Math.ceil(vyMin / step) * step;

  // Draw grid
  ctx.lineWidth = Math.max(1, Math.floor(dpr));
  ctx.strokeStyle = '#e3e3e3';
  ctx.beginPath();
  for (let x = firstX; x <= vxMax + 1e-12; x += step) {
    const cx = toCX(x);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
  }
  for (let y = firstY; y <= vyMax + 1e-12; y += step) {
    const cy = toCY(y);
    ctx.moveTo(0, cy); ctx.lineTo(W, cy);
  }
  ctx.stroke();

  // Axes
  ctx.strokeStyle = '#e3e3e3';
  ctx.lineWidth = Math.max(1.5, 1.5 * dpr);
  if (vxMin <= 0 && 0 <= vxMax) { ctx.beginPath(); ctx.moveTo(toCX(0), 0); ctx.lineTo(toCX(0), H); ctx.stroke(); }
  if (vyMin <= 0 && 0 <= vyMax) { ctx.beginPath(); ctx.moveTo(0, toCY(0)); ctx.lineTo(W, toCY(0)); ctx.stroke(); }

  // Labels — SAME frequency on both axes
  const pxPerTick = step * scale;                  // pixels between ticks
  const minLabelPx = 45 * dpr;                     // desired spacing for labels
  const labelEvery = Math.max(1, Math.round(minLabelPx / pxPerTick)); // shared N

  ctx.font = `${Math.round(12 * dpr)}px sans-serif`;
  ctx.fillStyle = '#e3e3e3';

  // X labels
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  let k = 0;
  for (let x = firstX; x <= vxMax + 1e-12; x += step, k++) {
    if (Math.abs(x) < 1e-12) continue;             // skip 0; origin gets its own
    if (k % labelEvery !== 0) continue;
    const cx = toCX(x);
    const cy = (vyMin <= 0 && 0 <= vyMax) ? toCY(0) + 4 * dpr : H - 16 * dpr;
    ctx.fillText(fmtLabel(x, step), cx, cy);
  }

  // Y labels
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  k = 0;
  for (let y = firstY; y <= vyMax + 1e-12; y += step, k++) {
    if (Math.abs(y) < 1e-12) continue;
    if (k % labelEvery !== 0) continue;            // SAME N as X
    const cy = toCY(y);
    const cx = (vxMin <= 0 && 0 <= vxMax) ? toCX(0) - 4 * dpr : 22 * dpr;
    ctx.fillText(fmtLabel(y, step), cx, cy);
  }

  // Origin label
  if (vxMin <= 0 && 0 <= vxMax && vyMin <= 0 && 0 <= vyMax) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#e3e3e3';
    ctx.fillText('0', toCX(0) + 3 * dpr, toCY(0) + 3 * dpr);
  }
}

//////// END AXIS STUFF




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

  if (graphParams['showAxes']) {
    const windowBounds = calcWindowBounds(graphParams['xCenter'], graphParams['yCenter'], graphParams['yHeight'], canvasWidth, canvasHeight);
		drawAxes(canvasElem, graphParams['xCenter'], graphParams['yCenter'], windowBounds['xMin'], windowBounds['xMax'], windowBounds['yMin'], windowBounds['yMax']);
  }

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


