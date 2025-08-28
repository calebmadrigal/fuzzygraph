// fuzzygraph.js
// Logic to draw fuzzy graphs on a canvas

ZOOM_RATE = 1.5;
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

function calculateFuncForWindow(func, windowBounds, canvasWidth, canvasHeight) {
  var pixelToXMapper = makeLinearMapper([0, canvasWidth], [windowBounds['xMin'], windowBounds['xMax']], false);
  var pixelToYMapper = makeLinearMapper([canvasHeight, 0], [windowBounds['yMin'], windowBounds['yMax']], false);
  var minValue = 9999999;
  var maxValue = -9999999;
  var pixelValues = new Array(canvasWidth * canvasHeight);

  // Calculate values for each pixel, and find the min and max values
  for (var pixelX = 0; pixelX < canvasWidth; pixelX++) {
    for (var pixelY = 0; pixelY < canvasHeight; pixelY++) {
      var x = pixelToXMapper(pixelX);
      var y = pixelToYMapper(pixelY);
      var result = func(x, y);
      if (result > maxValue) {
        maxValue = result;
      }
      if (result < minValue) {
        minValue = result;
      }

      pixelValues[(pixelY * canvasWidth) + pixelX] = Math.abs(result);
    }
  }

  return {'pixelValues': pixelValues, 'max': maxValue, 'min': minValue};
}


// // // // // // // Display Graph


//////// START AXES STUFF

function drawAxes(canvas, xCenter, yCenter, xMin, xMax, yMin, yMax, options = {}) {
  // NOTE: This function written by ChatGPT 5 and modified by Caleb Madrigal.
  const ctx = canvas.getContext('2d');

  // ---- options ----
  const {
    labelBgColor = '#ffffff',         // background behind numbers
    labelBgAlpha = 1,                 // 1 = opaque; try 0.9 for subtle
    labelPaddingPx = 3,               // padding around label text (CSS px)
    fontPx = 12,                      // base CSS px (scaled by DPR)
    gridColor = '#e3e3e3',
    axisColor = '#e3e3e3',
    labelColor = '#333'               // make labels a tad darker for contrast
  } = options;

  // HiDPI handling (keeps result crisp if CSS size differs from width/height)
  const dpr = window.devicePixelRatio || 1;

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
  ctx.strokeStyle = gridColor;
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
  ctx.strokeStyle = axisColor;
  ctx.lineWidth = Math.max(1.5, 1.5 * dpr);
  if (vxMin <= 0 && 0 <= vxMax) { ctx.beginPath(); ctx.moveTo(toCX(0), 0); ctx.lineTo(toCX(0), H); ctx.stroke(); }
  if (vyMin <= 0 && 0 <= vyMax) { ctx.beginPath(); ctx.moveTo(0, toCY(0)); ctx.lineTo(W, toCY(0)); ctx.stroke(); }

  // Label styling
  const pad = labelPaddingPx * dpr;
  ctx.font = `${Math.round(fontPx * dpr)}px sans-serif`;

  // Helper: draw text with a background box that overwrites lines
  function drawLabel(text, x, y, {align='left', baseline='alphabetic'} = {}) {
    ctx.save();
    ctx.textAlign = align;
    ctx.textBaseline = baseline;

    // Measure text
    const m = ctx.measureText(text);
    const w = m.width;
    const ascent = m.actualBoundingBoxAscent ?? Math.ceil(0.8 * fontPx * dpr);
    const descent = m.actualBoundingBoxDescent ?? Math.ceil(0.2 * fontPx * dpr);
    const h = ascent + descent;

    // Compute rect corner from align/baseline
    let rx = x, ry = y;
    if (align === 'center') rx -= w / 2;
    else if (align === 'right') rx -= w;

    if (baseline === 'middle') ry -= h / 2;
    else if (baseline === 'top' || baseline === 'hanging') ; // already at top
    else if (baseline === 'alphabetic' || baseline === 'ideographic') ry -= ascent;
    else if (baseline === 'bottom') ry -= h;

    // Background patch
    ctx.globalAlpha = labelBgAlpha;
    ctx.fillStyle = labelBgColor;
    ctx.fillRect(rx - pad, ry - pad, w + 2*pad, h + 2*pad);

    // Text
    ctx.globalAlpha = 1;
    ctx.fillStyle = labelColor;
    ctx.fillText(text, x, y);

    ctx.restore();
  }

  // Labels — SAME frequency on both axes
  const pxPerTick = step * scale;                  // pixels between ticks
  const minLabelPx = 45 * dpr;                     // desired spacing for labels
  const labelEvery = Math.max(1, Math.round(minLabelPx / pxPerTick)); // shared N

  // X labels
  let k = 0;
  for (let x = firstX; x <= vxMax + 1e-12; x += step, k++) {
    if (Math.abs(x) < 1e-12) continue;             // skip 0; origin gets its own
    if (k % labelEvery !== 0) continue;
    const cx = toCX(x);
    const cy = (vyMin <= 0 && 0 <= vyMax) ? toCY(0) + 4 * dpr : H - 16 * dpr;
    drawLabel(fmtLabel(x, step), cx, cy, { align: 'center', baseline: 'top' });
  }

  // Y labels
  k = 0;
  for (let y = firstY; y <= vyMax + 1e-12; y += step, k++) {
    if (Math.abs(y) < 1e-12) continue;
    if (k % labelEvery !== 0) continue;            // SAME N as X
    const cy = toCY(y);
    const cx = (vxMin <= 0 && 0 <= vxMax) ? toCX(0) - 4 * dpr : 22 * dpr;
    drawLabel(fmtLabel(y, step), cx, cy, { align: 'right', baseline: 'middle' });
  }

  // Origin label
  if (vxMin <= 0 && 0 <= vxMax && vyMin <= 0 && 0 <= vyMax) {
    drawLabel('0', toCX(0) + 3 * dpr, toCY(0) + 3 * dpr, { align: 'left', baseline: 'top' });
  }
}


//////// END AXIS STUFF


// // // // // // // START Color stuff

function truthygraphColormap(minInput, maxInput) {
    var colorChannelRange = [0, 255];
    var colorMapper = makeLinearMapper([minInput, maxInput], colorChannelRange, true);

    var mapper = function(val) {
        var colorVal = colorMapper(val);
        return [colorVal, colorVal, 100];
    };

    return mapper;
}

function getColormap(colormapName, invertColor, minInput, maxInput) {
  // Transform min and max inputs to [0, 1] so that it can be plugged into colorma
  const valueNormalizer = makeLinearMapper([minInput, maxInput], [0, 1], false);
  var mapper = function(val) {
    var normalizedValue = valueNormalizer(val);
    if (normalizedValue > 1) { normalizedValue = 1; }
    else if (normalizedValue < 0) { normalizedValue = 0; }
    else if (isNaN(normalizedValue)) { normalizedValue = 0; }  // Happens with divide by 0
    return evaluate_cmap(normalizedValue, colormapName, invertColor);
  }

  return mapper;
}

// // // // // // // END Color stuff

function displayFuzzyGraph(pixelValues, minValue, maxValue, fuzzyValue, colormapName, invertColor, canvasElem) {
  var maxCutoff = 100;  // TODO: Make this configurable
  var context = canvasElem.getContext('2d');
  var canvasWidth = context.canvas.width;
  var canvasHeight = context.canvas.height;
  var imageData = context.createImageData(canvasWidth, canvasHeight);
  var pixelData = imageData.data;

  // Function to modify the value to make the graph look more interesting
  // We do this because the value is a measure of error, but we want more error
  // to look like a more intense value on the graph
  var valueModifier = function (value) {
    return Math.pow(maxValue - value, (MAX_FUZZY+1) - fuzzyValue);  // +1 to prevent the value from ever being 0
  };

  // For display purposes, allow a max and min value (TODO: Make them configurable via UI)
  maxValue = Math.min(maxValue, maxCutoff);

  // Determine the color scale based on the min and max values
  //var colorMapper = truthygraphColormap(valueModifier(maxValue), valueModifier(minValue));
  var colorMapper = getColormap(colormapName, invertColor, valueModifier(minValue), valueModifier(maxValue));
  //var colorMapper = getColormap(colormapName, invertColor, minValue, maxValue);

  // Set the color for each pixel based on the values
  for (var x = 0; x < canvasWidth; x++) {
    for (var y = 0; y < canvasHeight; y++) {
      var value = valueModifier(pixelValues[y * canvasWidth + x]);
      var color = colorMapper(value);

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

function ensureCanvasSize(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;   // NOTE: this clears the canvas, so do it before drawing
  }
}

function displayGraph(graphParams, canvasElem) {
  const canvasWidth = canvasElem.width;
  const canvasHeight = canvasElem.height;
  var windowBounds = calcWindowBounds(graphParams['xCenter'],
      graphParams['yCenter'],
      graphParams['yHeight'],
      canvasWidth,
      canvasHeight);

  const t1 = performance.now();
  var pixelValues = calculateFuncForWindow(graphParams['equationFunction'],
      windowBounds,
      canvasWidth,
      canvasHeight);
  const t2 = performance.now();

  displayFuzzyGraph(pixelValues['pixelValues'],
      pixelValues['min'],
      pixelValues['max'],
      graphParams['fuzzyLevel'],
      graphParams['colorMap'],
      graphParams['invertColor'],
      canvasElem);

  if (graphParams['showAxes']) {
    const windowBounds = calcWindowBounds(graphParams['xCenter'], graphParams['yCenter'], graphParams['yHeight'], canvasWidth, canvasHeight);
		drawAxes(canvasElem, graphParams['xCenter'], graphParams['yCenter'], windowBounds['xMin'], windowBounds['xMax'], windowBounds['yMin'], windowBounds['yMax']);
  }

  const t3 = performance.now();

  const elapsed1 = t2-t1;
  const elapsed2 = t3-t2;

  return pixelValues['pixelValues'];
}

