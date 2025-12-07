// fuzzygraph_glsl.js
// Logic to draw fuzzy graphs on a canvas using GLSL fragment shading

import { create, all } from 'mathjs';
const math = create(all);

// import { evaluate_cmap } from './js-colormaps.js';
import { getMatplotlibColormap } from './ga_color.js';

export const ZOOM_RATE = 1.5;
export const MAX_FUZZY = 200;

export function isMandelbrotEquation(eqStr) {
  if (!eqStr || typeof eqStr !== 'string') return false;
  return eqStr.toLowerCase().includes('mandelbrot');
}

export function parseMandelbrotParams(eqStr, { defaultMax = 1000, defaultThreshold = 100, onParamsParsed } = {}) {
  const maxMatch = eqStr.match(/max_iterations\s*=\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i);
  const thresholdMatch = eqStr.match(/threshold\s*=\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i);

  const parsedMax = Number(maxMatch && maxMatch[1]);
  const parsedThreshold = Number(thresholdMatch && thresholdMatch[1]);

  const maxVal = Number.isFinite(parsedMax) ? parsedMax : defaultMax;
  const thresholdVal = Number.isFinite(parsedThreshold) ? parsedThreshold : defaultThreshold;

  if (typeof onParamsParsed === 'function') {
    onParamsParsed({ maxVal, thresholdVal });
  }

  return { maxVal, thresholdVal };
}

export function createMandelbrotFunction(eqStr, options = {}) {
  const { maxVal, thresholdVal } = parseMandelbrotParams(eqStr, options);
  const maxIterations = Math.max(1, Math.floor(maxVal));

  return {
    _source: eqStr,
    _isPolar: false,
    _isJsFunction: false,
    _isMandelbrot: true,
    maxIterations,
    threshold: thresholdVal
  };
}

// // // // // // // Math stuff

export function makeLinearMapper(inRange, outRange, intOut) {
  const inDelta = inRange[1] - inRange[0];
  const outDelta = outRange[1] - outRange[0];
  const m = (outDelta / inDelta);
  const b = outRange[0] - m * inRange[0];

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

export function cartesian_to_polar(x, y) {
  const r = math.sqrt(x**2 + y**2);
  var theta = math.atan2(y, x);
  if (theta < 0) theta += 2 * Math.PI;
  return {'r': r, 't': theta};
}

export function parsePolarEquationString(eq_str) {
  if (eq_str.includes("≈")) {
    var split_result = eq_str.split("≈");
  }
  else {
    var split_result = eq_str.split("=");
  }
  if (split_result.length != 2) {
    return null;
  }

  try {
    const left_polar = math.evaluate('f(r, t) = ' + split_result[0], {});
    const right_polar = math.evaluate('f(r, t) = ' + split_result[1], {});
    var left_eq = (x, y) => {
      const p_coords = cartesian_to_polar(x, y);
      return left_polar(p_coords['r'], p_coords['t']);
    };
    var right_eq = (x, y) => {
      const p_coords = cartesian_to_polar(x, y);
      return right_polar(p_coords['r'], p_coords['t']);
    };

    left_eq(0.01, 0.01);
    right_eq(0.01, 0.01);
  } catch (error) {
    console.log(`Failed to parse polar equation: ${error}`);
    return null;
  }
  var error_func = function (x, y) { return Math.abs(left_eq(x, y) - right_eq(x, y)); };

  return error_func;
}

function isPolarEquation(eq_str) {
  const cleanEq = eq_str.toLowerCase().replace(/\s+/g, '');
  const polarRegex = /\br\b|\bt\b/;
  return polarRegex.test(cleanEq);
}

function isJsFunction(eq_str) {
  if (typeof eq_str !== 'string') return false;

  try {
    const fn = new Function(`return (${eq_str});`)();
    return typeof fn === 'function';
  } catch (e) {
    return false;
  }
}

function getFunctionFromCode(jsCode) {
  return eval(`(function(){ ${jsCode}; return f; })()`);
}

export function parseEquationString(eq_str) {
  if (isPolarEquation(eq_str)) {
    const fn = parsePolarEquationString(eq_str);
    if (fn) {
      fn._source = eq_str;
      fn._isPolar = true;
      fn._isJsFunction = false;
    }
    return fn;
  }
  else if (isJsFunction(eq_str)) {
    const fn = getFunctionFromCode(eq_str);
    if (fn) {
      fn._source = eq_str;
      fn._isPolar = false;
      fn._isJsFunction = true;
    }
    return fn;
  }

  if (eq_str.includes("≈")) {
    var split_result = eq_str.split("≈");
  }
  else {
    var split_result = eq_str.split("=");
  }
  if (split_result.length != 2) {
    return null;
  }

  try {
    var left_eq = math.evaluate('f(x, y) = ' + split_result[0], {});
    var right_eq = math.evaluate('f(x, y) = ' + split_result[1], {});

    left_eq(0.01, 0.01);
    right_eq(0.01, 0.01);
  } catch (error) {
    console.log(`Error parsing equation: ${error}`);
    return null;
  }
  var error_func = function (x, y) { return Math.abs(left_eq(x, y) - right_eq(x, y)); };

  error_func._source = eq_str;
  error_func._isPolar = false;
  error_func._isJsFunction = false;

  return error_func;
}

export function getXMin(xWidth, xCenter) {
  return -1 * xWidth / 2 + xCenter;
}

export function getXMax(xWidth, xCenter) {
  return xWidth / 2 + xCenter;
}

export function getYMin(yHeight, yCenter) {
  return -1 * yHeight / 2 + yCenter;
}

export function getYMax(yHeight, yCenter) {
  return yHeight / 2 + yCenter;
}

export function getHeightToWidthMultiplier(xWidth, yHeight) {
  return xWidth / yHeight;
}

export function getXWidth(yHeight, canvasWidth, canvasHeight) {
  return yHeight * getHeightToWidthMultiplier(canvasWidth, canvasHeight);
}

export function calcWindowBounds(xCenter, yCenter, yHeight, canvasWidth, canvasHeight) {
  var xWidth = getXWidth(yHeight, canvasWidth, canvasHeight);

  return {
    'xMin': getXMin(xWidth, xCenter),
    'xMax': getXMax(xWidth, xCenter),
    'yMin': getYMin(yHeight, yCenter),
    'yMax': getYMax(yHeight, yCenter)
  };
}

function glslNumber(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) {
    throw new Error(`Non-finite numeric literal: ${val}`);
  }
  if (Number.isInteger(num)) {
    return `${num}.0`;
  }
  return `${num}`;
}

function buildMandelbrotShader(maxIterations, threshold) {
  const maxIterInt = Math.max(1, Math.floor(maxIterations));
  return `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform vec4 uBounds;

void main() {
  vec2 frag = gl_FragCoord.xy;
  float x = mix(uBounds.x, uBounds.y, frag.x / uResolution.x);
  float y = mix(uBounds.z, uBounds.w, (uResolution.y - frag.y) / uResolution.y);

  float zx = x;
  float zy = y;
  float cx = x;
  float cy = y;
  int steps = 0;

  for (int i = 0; i < ${maxIterInt}; i++) {
    float nextZx = (zx * zx) - (zy * zy) + cx;
    float nextZy = 2.0 * zx * zy + cy;
    zx = nextZx;
    zy = nextZy;

    if (length(vec2(zx, zy)) > ${glslNumber(threshold)}) {
      break;
    }

    steps++;
  }

  float result = steps == ${maxIterInt} ? float(${maxIterInt - 1}) : float(steps);
  outColor = vec4(result, 0.0, 0.0, 1.0);
}`;
}

function nodeToGLSL(node) {
  switch (node.type) {
    case 'ConstantNode':
      return glslNumber(node.value);
    case 'SymbolNode': {
      const name = node.name;
      if (name === 'x' || name === 'y' || name === 'r' || name === 't') return name;
      if (name === 'pi' || name === 'PI') return '3.141592653589793';
      if (name === 'e' || name === 'E') return '2.718281828459045';
      throw new Error(`Unsupported symbol ${name} in equation`);
    }
    case 'ParenthesisNode':
      return `(${nodeToGLSL(node.content)})`;
    case 'UnaryMinusNode':
      return `(-${nodeToGLSL(node.args[0])})`;
    case 'OperatorNode': {
      const op = node.op;
      if (op === '^') {
        return `pow(${nodeToGLSL(node.args[0])}, ${nodeToGLSL(node.args[1])})`;
      }
      if (node.args.length === 1) {
        return `(${op}${nodeToGLSL(node.args[0])})`;
      }
      const left = nodeToGLSL(node.args[0]);
      const right = node.args[1] ? nodeToGLSL(node.args[1]) : '';
      return `(${left} ${op} ${right})`;
    }
    case 'FunctionNode': {
      const fnName = node.name;
      const args = node.args.map(nodeToGLSL).join(', ');
      const fnMap = {
        'sin': 'sin', 'cos': 'cos', 'tan': 'tan', 'asin': 'asin', 'acos': 'acos', 'atan': 'atan',
        'atan2': 'atan', 'log': 'log', 'ln': 'log', 'exp': 'exp', 'sqrt': 'sqrt', 'abs': 'abs',
        'min': 'min', 'max': 'max', 'pow': 'pow'
      };
      if (fnMap[fnName]) {
        return `${fnMap[fnName]}(${args})`;
      }
      throw new Error(`Unsupported function ${fnName} in equation`);
    }
    default:
      throw new Error(`Unsupported AST node ${node.type}`);
  }
}

function equationToGLSL(eqStr) {
  const delimiter = eqStr.includes('≈') ? '≈' : '=';
  const parts = eqStr.split(delimiter);
  if (parts.length !== 2) {
    throw new Error('Equation must contain a single equals sign.');
  }
  const [left, right] = parts;
  const leftAst = math.parse(left);
  const rightAst = math.parse(right);
  const leftExpr = nodeToGLSL(leftAst);
  const rightExpr = nodeToGLSL(rightAst);
  return `abs((${leftExpr}) - (${rightExpr}))`;
}

function buildEvalShader(eqStr, isPolar) {
  const expr = equationToGLSL(eqStr);
  const polarPrelude = isPolar ? `
  float r = length(vec2(x, y));
  float t = atan(y, x);
  if (t < 0.0) { t += 6.28318530718; }
` : '';
  return `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uResolution;
uniform vec4 uBounds;
float evalEquation(float x, float y) {
${polarPrelude}
  return ${expr};
}
void main() {
  vec2 frag = gl_FragCoord.xy;
  float x = mix(uBounds.x, uBounds.y, frag.x / uResolution.x);
  float y = mix(uBounds.z, uBounds.w, (uResolution.y - frag.y) / uResolution.y);
  float val = abs(evalEquation(x, y));
  outColor = vec4(val, 0.0, 0.0, 1.0);
}`;
}

function getMandelbrotProgram(gl, func) {
  const cached = glState.mandelbrotProgram;
  if (cached && cached._maxIterations === func.maxIterations && cached._threshold === func.threshold) {
    return cached;
  }
  const fragSrc = buildMandelbrotShader(func.maxIterations, func.threshold);
  const program = createProgram(gl, VERT_SRC, fragSrc);
  program._maxIterations = func.maxIterations;
  program._threshold = func.threshold;
  glState.mandelbrotProgram = program;
  return program;
}

function ensureValueResources(gl, width, height) {
  const sameSize = glState.valueSize && glState.valueSize.width === width && glState.valueSize.height === height;
  const needsTex = !glState.valuesTex;
  if (!needsTex && sameSize) {
    return;
  }
  if (needsTex) {
    glState.valuesTex = gl.createTexture();
    glState.valueFbo = gl.createFramebuffer();
  }
  gl.bindTexture(gl.TEXTURE_2D, glState.valuesTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, null);
  glState.valueSize = { width, height };

  gl.bindFramebuffer(gl.FRAMEBUFFER, glState.valueFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, glState.valuesTex, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('Failed to create framebuffer for evaluation.');
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function getEvalProgram(gl, eqStr, isPolar) {
  if (glState.evalProgram && glState.evalProgram._eqStr === eqStr && glState.evalProgram._isPolar === isPolar) {
    return glState.evalProgram;
  }
  const fragSrc = buildEvalShader(eqStr, isPolar);
  const program = createProgram(gl, VERT_SRC, fragSrc);
  program._eqStr = eqStr;
  program._isPolar = isPolar;
  glState.evalProgram = program;
  return program;
}

function evaluateMandelbrotToTexture(func, windowBounds, canvasWidth, canvasHeight) {
  ensureGL(canvasWidth, canvasHeight);
  const gl = glState.gl;
  ensureValueResources(gl, canvasWidth, canvasHeight);
  const program = getMandelbrotProgram(gl, func);

  gl.useProgram(program);
  gl.bindVertexArray(glState.vao);
  gl.viewport(0, 0, canvasWidth, canvasHeight);
  gl.bindFramebuffer(gl.FRAMEBUFFER, glState.valueFbo);

  gl.uniform2f(gl.getUniformLocation(program, 'uResolution'), canvasWidth, canvasHeight);
  gl.uniform4f(gl.getUniformLocation(program, 'uBounds'), windowBounds['xMin'], windowBounds['xMax'], windowBounds['yMin'], windowBounds['yMax']);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  const values = new Float32Array(canvasWidth * canvasHeight);
  gl.readPixels(0, 0, canvasWidth, canvasHeight, gl.RED, gl.FLOAT, values);
  let minValue = Infinity;
  let maxValue = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < minValue) minValue = v;
    if (v > maxValue) maxValue = v;
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { pixelValues: values, min: minValue, max: maxValue, fromGPU: true };
}

function evaluateEquationToTexture(func, windowBounds, canvasWidth, canvasHeight) {
  if (func && func._isMandelbrot) {
    return evaluateMandelbrotToTexture(func, windowBounds, canvasWidth, canvasHeight);
  }
  if (!func || !func._source || func._isJsFunction) {
    throw new Error('Equation source unavailable for GPU evaluation.');
  }
  ensureGL(canvasWidth, canvasHeight);
  const gl = glState.gl;
  ensureValueResources(gl, canvasWidth, canvasHeight);
  const program = getEvalProgram(gl, func._source, func._isPolar);

  gl.useProgram(program);
  gl.bindVertexArray(glState.vao);
  gl.viewport(0, 0, canvasWidth, canvasHeight);
  gl.bindFramebuffer(gl.FRAMEBUFFER, glState.valueFbo);

  gl.uniform2f(gl.getUniformLocation(program, 'uResolution'), canvasWidth, canvasHeight);
  gl.uniform4f(gl.getUniformLocation(program, 'uBounds'), windowBounds['xMin'], windowBounds['xMax'], windowBounds['yMin'], windowBounds['yMax']);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  const values = new Float32Array(canvasWidth * canvasHeight);
  gl.readPixels(0, 0, canvasWidth, canvasHeight, gl.RED, gl.FLOAT, values);
  let minValue = Infinity;
  let maxValue = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < minValue) minValue = v;
    if (v > maxValue) maxValue = v;
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { pixelValues: values, min: minValue, max: maxValue, fromGPU: true };
}

function buildMandelbrotCpuEvaluator(func) {
  const maxIterations = Math.max(1, Math.floor(func.maxIterations || 0));
  const thresholdVal = func.threshold;
  return (x, y) => {
    let zx = x;
    let zy = y;
    const cx = x;
    const cy = y;
    let stepsTaken = 0;

    for (; stepsTaken < maxIterations; stepsTaken++) {
      const prevZx = zx;
      const prevZy = zy;
      const nextZx = prevZx * prevZx - prevZy * prevZy + cx;
      const nextZy = 2 * prevZx * prevZy + cy;
      zx = nextZx;
      zy = nextZy;

      if (Math.hypot(zx, zy) > thresholdVal) {
        break;
      }
    }

    return stepsTaken === maxIterations ? maxIterations - 1 : stepsTaken;
  };
}

export function calculateFuncForWindow(func, windowBounds, canvasWidth, canvasHeight) {
  try {
    return evaluateEquationToTexture(func, windowBounds, canvasWidth, canvasHeight);
  } catch (err) {
    console.warn('Falling back to CPU evaluation:', err);
  }

  var pixelToXMapper = makeLinearMapper([0, canvasWidth], [windowBounds['xMin'], windowBounds['xMax']], false);
  var pixelToYMapper = makeLinearMapper([canvasHeight, 0], [windowBounds['yMin'], windowBounds['yMax']], false);
  var minValue = 9999999;
  var maxValue = -9999999;
  var pixelValues = new Float32Array(canvasWidth * canvasHeight);
  const fallbackFunc = func && func._isMandelbrot ? buildMandelbrotCpuEvaluator(func) : func;

  for (var pixelX = 0; pixelX < canvasWidth; pixelX++) {
    for (var pixelY = 0; pixelY < canvasHeight; pixelY++) {
      var x = pixelToXMapper(pixelX);
      var y = pixelToYMapper(pixelY);
      var result = fallbackFunc(x, y);
      if (result > maxValue) {
        maxValue = result;
      }
      if (result < minValue) {
        minValue = result;
      }

      pixelValues[(pixelY * canvasWidth) + pixelX] = Math.abs(result);
    }
  }

  return {'pixelValues': pixelValues, 'max': maxValue, 'min': minValue, fromGPU: false};
}

// // // // // // // Display Graph

export function drawAxes(canvas, xCenter, yCenter, xMin, xMax, yMin, yMax, options = {}) {
  const ctx = canvas.getContext('2d');

  const {
    labelBgColor = '#ffffff',
    labelBgAlpha = 1,
    labelPaddingPx = 3,
    fontPx = 12,
    gridColor = '#e3e3e3',
    axisColor = '#e3e3e3',
    labelColor = '#333'
  } = options;

  const dpr = window.devicePixelRatio || 1;

  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1,0,0,1,0,0);

  const spanX = Math.max(1e-12, xMax - xMin);
  const spanY = Math.max(1e-12, yMax - yMin);

  const scale = Math.min(W / spanX, H / spanY);

  const showSpanX = W / scale;
  const showSpanY = H / scale;

  const vxMin = xCenter - showSpanX/2, vxMax = xCenter + showSpanX/2;
  const vyMin = yCenter - showSpanY/2, vyMax = yCenter + showSpanY/2;

  const toCX = x => (x - xCenter) * scale + W/2;
  const toCY = y => H/2 - (y - yCenter) * scale;

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

  const targetPx = 80 * dpr;
  const step = niceStep(targetPx / scale);

  const firstX = Math.ceil(vxMin / step) * step;
  const firstY = Math.ceil(vyMin / step) * step;

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

  ctx.strokeStyle = axisColor;
  ctx.lineWidth = Math.max(1.5, 1.5 * dpr);
  if (vxMin <= 0 && 0 <= vxMax) { ctx.beginPath(); ctx.moveTo(toCX(0), 0); ctx.lineTo(toCX(0), H); ctx.stroke(); }
  if (vyMin <= 0 && 0 <= vyMax) { ctx.beginPath(); ctx.moveTo(0, toCY(0)); ctx.lineTo(W, toCY(0)); ctx.stroke(); }

  const pad = labelPaddingPx * dpr;
  ctx.font = `${Math.round(fontPx * dpr)}px sans-serif`;

  function drawLabel(text, x, y, {align='left', baseline='alphabetic'} = {}) {
    ctx.save();
    ctx.textAlign = align;
    ctx.textBaseline = baseline;

    const m = ctx.measureText(text);
    const w = m.width;
    const ascent = m.actualBoundingBoxAscent ?? Math.ceil(0.8 * fontPx * dpr);
    const descent = m.actualBoundingBoxDescent ?? Math.ceil(0.2 * fontPx * dpr);
    const h = ascent + descent;

    let rx = x, ry = y;
    if (align === 'center') rx -= w / 2;
    else if (align === 'right') rx -= w;

    if (baseline === 'middle') ry -= h / 2;
    else if (baseline === 'top' || baseline === 'hanging') ;
    else if (baseline === 'alphabetic' || baseline === 'ideographic') ry -= ascent;
    else if (baseline === 'bottom') ry -= h;

    ctx.globalAlpha = labelBgAlpha;
    ctx.fillStyle = labelBgColor;
    ctx.fillRect(rx - pad, ry - pad, w + 2*pad, h + 2*pad);

    ctx.globalAlpha = 1;
    ctx.fillStyle = labelColor;
    ctx.fillText(text, x, y);

    ctx.restore();
  }

  const pxPerTick = step * scale;
  const minLabelPx = 45 * dpr;
  const labelEvery = Math.max(1, Math.round(minLabelPx / pxPerTick));

  let k = 0;
  for (let x = firstX; x <= vxMax + 1e-12; x += step, k++) {
    if (Math.abs(x) < 1e-12) continue;
    if (k % labelEvery !== 0) continue;
    const cx = toCX(x);
    const cy = (vyMin <= 0 && 0 <= vyMax) ? toCY(0) + 4 * dpr : H - 16 * dpr;
    drawLabel(fmtLabel(x, step), cx, cy, { align: 'center', baseline: 'top' });
  }

  k = 0;
  for (let y = firstY; y <= vyMax + 1e-12; y += step, k++) {
    if (Math.abs(y) < 1e-12) continue;
    if (k % labelEvery !== 0) continue;
    const cy = toCY(y);
    const cx = (vxMin <= 0 && 0 <= vxMax) ? toCX(0) - 4 * dpr : 22 * dpr;
    drawLabel(fmtLabel(y, step), cx, cy, { align: 'right', baseline: 'middle' });
  }

  if (vxMin <= 0 && 0 <= vxMax && vyMin <= 0 && 0 <= vyMax) {
    drawLabel('0', toCX(0) + 3 * dpr, toCY(0) + 3 * dpr, { align: 'left', baseline: 'top' });
  }
}

function calculateFuzzyFactor(fuzzyValue) {
  return 0.01 * fuzzyValue;
}

function applyFuzzyTransfer(value, rawMin, rawMax, fuzzyValue, alpha = 1.0) {
  if (fuzzyValue >= 1) {
    const fuzzyFactor = calculateFuzzyFactor(fuzzyValue);
    return Math.pow((alpha * value) + 1e-6, fuzzyFactor);
  }
  return value < 0.02 ? rawMax : rawMin;
}

function createColormapLUT(colormapName, reverseColor, invertColor, colorStart = 0, colorCycles = 1) {
  const lut = new Uint8Array(256 * 4);
  const mapper = getMatplotlibColormap(0, 1, colormapName, reverseColor, invertColor, colorCycles, colorStart);
  for (let i = 0; i < 256; i++) {
    const normalizedValue = i / 255;
    // const color = evaluate_cmap(normalizedValue, colormapName, invertColor, colorStart, colorCycles);
    const color = mapper(normalizedValue);
    const offset = i * 4;
    lut[offset] = color[0];
    lut[offset + 1] = color[1];
    lut[offset + 2] = color[2];
    lut[offset + 3] = 255;
  }
  return lut;
}

function ensureCanvasSize(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  // If the canvas isn't attached to the DOM (e.g. offscreen render for downloads),
  // getBoundingClientRect will return 0 for width/height. In that case, respect the
  // current intrinsic size that was already set by the caller.
  const hasSizeFromDOM = rect.width > 0 && rect.height > 0;
  const w = hasSizeFromDOM ? Math.max(1, Math.round(rect.width * dpr)) : canvas.width;
  const h = hasSizeFromDOM ? Math.max(1, Math.round(rect.height * dpr)) : canvas.height;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Could not compile shader: ${info}`);
  }
  return shader;
}

function createProgram(gl, vertexSrc, fragmentSrc) {
  const program = gl.createProgram();
  const vs = createShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Could not link program: ${info}`);
  }
  return program;
}

const VERT_SRC = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = (aPos + 1.0) * 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uValues;
uniform sampler2D uColormap;
uniform vec2 uResolution;
uniform float uNormMin;
uniform float uNormMax;
uniform float uRawMin;
uniform float uRawMax;
uniform float uFuzzy;
uniform float uAlpha;

float transfer(float value) {
  if (uFuzzy >= 1.0) {
    float fuzzyFactor = 0.01 * uFuzzy;
    return pow((uAlpha * value) + 1e-6, fuzzyFactor);
  } else {
    return value < 0.02 ? uRawMax : uRawMin;
  }
}

void main() {
  vec2 uv = vec2(gl_FragCoord.x / uResolution.x, 1.0 - (gl_FragCoord.y / uResolution.y));
  float value = texture(uValues, uv).r;
  float modified = transfer(value);
  float t = clamp((modified - uNormMin) / max(1e-6, uNormMax - uNormMin), 0.0, 1.0);
  vec4 cmap = texture(uColormap, vec2(t, 0.5));
  outColor = vec4(cmap.rgb, 1.0);
}`;

const glState = {
  gl: null,
  program: null,
  evalProgram: null,
  mandelbrotProgram: null,
  vao: null,
  valuesTex: null,
  valueFbo: null,
  valueSize: null,
  colormapTex: null,
  canvas: null,
  floatExt: null,
};

function initGL(width, height) {
  if (!glState.canvas) {
    glState.canvas = document.createElement('canvas');
  }
  glState.canvas.width = width;
  glState.canvas.height = height;
  const gl = glState.canvas.getContext('webgl2');
  if (!gl) {
    throw new Error('WebGL2 is not supported in this environment.');
  }
  const floatExt = gl.getExtension('EXT_color_buffer_float');
  if (!floatExt) {
    throw new Error('EXT_color_buffer_float is required for GPU rendering.');
  }
  glState.floatExt = floatExt;
  glState.gl = gl;
  gl.viewport(0, 0, width, height);

  const program = createProgram(gl, VERT_SRC, FRAG_SRC);
  glState.program = program;
  gl.useProgram(program);

  const quad = new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
     1,  1,
  ]);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  glState.vao = vao;

  const colormapTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, colormapTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  glState.colormapTex = colormapTex;

  ensureValueResources(gl, width, height);
}

function ensureGL(width, height) {
  if (!glState.gl) {
    initGL(width, height);
  } else if (glState.canvas.width !== width || glState.canvas.height !== height) {
    glState.canvas.width = width;
    glState.canvas.height = height;
    glState.gl.viewport(0, 0, width, height);
  }
  ensureValueResources(glState.gl, width, height);
}

function uploadValuesTexture(pixelValues, width, height) {
  if (!pixelValues) return;
  const gl = glState.gl;
  gl.bindTexture(gl.TEXTURE_2D, glState.valuesTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, pixelValues);
}

function uploadColormapTexture(colormapName, reverseColor, invertColor, colorStart = 0, colorCycles = 1) {
  const gl = glState.gl;
  const lut = createColormapLUT(colormapName, reverseColor, invertColor, colorStart, colorCycles);
  gl.bindTexture(gl.TEXTURE_2D, glState.colormapTex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut);
}

function renderToCanvas(canvasElem, pixelValues, rawMin, rawMax, normMin, normMax, fuzzyValue, colormapName, reverseColor, invertColor, colorStart, colorCycles) {
  ensureCanvasSize(canvasElem);
  const width = canvasElem.width;
  const height = canvasElem.height;
  ensureGL(width, height);
  const gl = glState.gl;

  uploadValuesTexture(pixelValues, width, height);
  uploadColormapTexture(colormapName, reverseColor, invertColor, colorStart, colorCycles);

  gl.useProgram(glState.program);
  gl.bindVertexArray(glState.vao);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, glState.valuesTex);
  gl.uniform1i(gl.getUniformLocation(glState.program, 'uValues'), 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, glState.colormapTex);
  gl.uniform1i(gl.getUniformLocation(glState.program, 'uColormap'), 1);

  gl.uniform2f(gl.getUniformLocation(glState.program, 'uResolution'), width, height);
  gl.uniform1f(gl.getUniformLocation(glState.program, 'uNormMin'), normMin);
  gl.uniform1f(gl.getUniformLocation(glState.program, 'uNormMax'), normMax);
  gl.uniform1f(gl.getUniformLocation(glState.program, 'uRawMin'), rawMin);
  gl.uniform1f(gl.getUniformLocation(glState.program, 'uRawMax'), rawMax);
  gl.uniform1f(gl.getUniformLocation(glState.program, 'uFuzzy'), fuzzyValue);
  gl.uniform1f(gl.getUniformLocation(glState.program, 'uAlpha'), 1.0);

  gl.viewport(0, 0, width, height);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  const ctx2d = canvasElem.getContext('2d');
  ctx2d.setTransform(1, 0, 0, 1, 0, 0);
  ctx2d.clearRect(0, 0, width, height);
  ctx2d.drawImage(glState.canvas, 0, 0, width, height);
}

export function displayGraph(graphParams, canvasElem) {
  ensureCanvasSize(canvasElem);
  const canvasWidth = canvasElem.width;
  const canvasHeight = canvasElem.height;
  var windowBounds = calcWindowBounds(graphParams['xCenter'],
      graphParams['yCenter'],
      graphParams['yHeight'],
      canvasWidth,
      canvasHeight);

  var pixelValues = calculateFuncForWindow(graphParams['equationFunction'],
      windowBounds,
      canvasWidth,
      canvasHeight);

  var minVal = pixelValues['min'];
  var maxVal = pixelValues['max'];

  if (graphParams['minOverride'] != null && graphParams['minOverride'] != '') {
    minVal = graphParams['minOverride'];
  }
  if (graphParams['maxOverride'] != null && graphParams['maxOverride'] != '') {
    maxVal = graphParams['maxOverride'];
  }

  const normMin = applyFuzzyTransfer(minVal, minVal, maxVal, graphParams['fuzzyLevel'], 1.0);
  const normMax = applyFuzzyTransfer(maxVal, minVal, maxVal, graphParams['fuzzyLevel'], 1.0);

  renderToCanvas(canvasElem,
      pixelValues['fromGPU'] ? null : pixelValues['pixelValues'],
      minVal,
      maxVal,
      normMin,
      normMax,
      graphParams['fuzzyLevel'],
      graphParams['colorMap'],
      graphParams['reverseColor'],
      graphParams['invertColor'],
      graphParams['colorStart'],
      graphParams['colorCycles']);

  if (graphParams['showAxes']) {
    const windowBounds2 = calcWindowBounds(graphParams['xCenter'], graphParams['yCenter'], graphParams['yHeight'], canvasWidth, canvasHeight);
    drawAxes(canvasElem, graphParams['xCenter'], graphParams['yCenter'], windowBounds2['xMin'], windowBounds2['xMax'], windowBounds2['yMin'], windowBounds2['yMax']);
  }

  return pixelValues;
}
