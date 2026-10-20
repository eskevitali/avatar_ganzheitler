const COLS = 48;
const ROWS = 48;
const MOUTH = {x: 0.5, y: 0.662};
const EYES = [
  {x: 0.335, y: 0.425, rx: 0.1, ry: 0.036},
  {x: 0.665, y: 0.425, rx: 0.1, ry: 0.036},
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const falloff = (x, y, cx, cy, rx, ry) => {
  const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
  if (d >= 1) return 0;
  const t = 1 - d;
  return t * t * (3 - 2 * t);
};

const vertexShader = `
attribute vec2 a_pos;
attribute vec2 a_uv;
varying vec2 v_uv;
varying vec2 v_pos;
void main() {
  v_uv = a_uv;
  v_pos = a_pos;
  gl_Position = vec4(a_pos.x * 2.0 - 1.0, 1.0 - a_pos.y * 2.0, 0.0, 1.0);
}
`;

const fragmentShader = `
precision mediump float;
varying vec2 v_uv;
varying vec2 v_pos;
uniform sampler2D u_image;
uniform float u_open;
uniform float u_round;
uniform float u_blink;
uniform float u_smile;
uniform vec2 u_mouth;

float coverEye(vec2 uv, vec2 eye, vec2 radius, float amount) {
  vec2 q = (uv - eye) / radius;
  float inside = 1.0 - smoothstep(0.78, 1.15, length(q));
  float lid = eye.y - radius.y + amount * radius.y * 2.25;
  float covered = 1.0 - smoothstep(lid - radius.y * 0.05, lid + radius.y * 0.2, uv.y);
  return inside * covered;
}

void main() {
  vec4 face = texture2D(u_image, v_uv);
  float blink = clamp(max(u_blink, u_smile * 0.38), 0.0, 1.0);
  vec3 color = face.rgb;
  vec2 eyeR = vec2(0.1, 0.036);
  vec2 leftEye = vec2(0.335, 0.425);
  vec2 rightEye = vec2(0.665, 0.425);
  float leftCover = coverEye(v_uv, leftEye, eyeR, blink);
  float rightCover = coverEye(v_uv, rightEye, eyeR, blink);
  if (leftCover > 0.001) {
    vec3 lid = texture2D(u_image, vec2(v_uv.x, leftEye.y - eyeR.y * 1.35)).rgb;
    lid *= mix(0.78, 1.0, smoothstep(0.25, 0.85, leftCover));
    color = mix(color, lid, clamp(leftCover, 0.0, 1.0));
  }
  if (rightCover > 0.001) {
    vec3 lid = texture2D(u_image, vec2(v_uv.x, rightEye.y - eyeR.y * 1.35)).rgb;
    lid *= mix(0.78, 1.0, smoothstep(0.25, 0.85, rightCover));
    color = mix(color, lid, clamp(rightCover, 0.0, 1.0));
  }
  float width = mix(0.105, 0.062, u_round);
  float height = 0.012 + u_open * 0.034;
  vec2 q = (v_pos - u_mouth) / vec2(width, height);
  float hole = (1.0 - smoothstep(0.42, 1.05, length(q))) * smoothstep(0.03, 0.22, u_open);
  vec3 cavity = mix(vec3(0.28, 0.18, 0.26), vec3(0.05, 0.03, 0.06), smoothstep(0.15, 0.9, length(q)));
  color = mix(color, cavity, clamp(hole, 0.0, 1.0));
  gl_FragColor = vec4(color, 1.0);
}
`;

const compile = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log || 'shader');
  }
  return shader;
};

const displace = (x, y, pose) => {
  let dx = 0;
  let dy = 0;
  const upper = falloff(x, y, 0.5, 0.642, 0.12, 0.04);
  const lower = falloff(x, y, 0.5, 0.688, 0.13, 0.055);
  dy += -pose.open * 0.015 * upper;
  dy += pose.open * 0.034 * lower;
  const corner = falloff(x, y, 0.5, 0.662, 0.16, 0.06);
  dx += (x - 0.5) * pose.open * (pose.round * -0.35 + (1 - pose.round) * 0.22) * corner;

  const left = falloff(x, y, 0.438, 0.668, 0.07, 0.05);
  const right = falloff(x, y, 0.562, 0.668, 0.07, 0.05);
  dx += pose.smile * -0.014 * left + pose.smile * 0.014 * right;
  dy += pose.smile * -0.024 * (left + right);
  dy += pose.sad * 0.022 * (left + right);
  dx += pose.sad * 0.008 * left + pose.sad * -0.008 * right;

  dy += pose.surprise * -0.02 * falloff(x, y, 0.34, 0.355, 0.1, 0.05);
  dy += pose.surprise * -0.02 * falloff(x, y, 0.66, 0.355, 0.1, 0.05);
  dy += pose.sad * -0.014 * falloff(x, y, 0.42, 0.36, 0.06, 0.04);
  dy += pose.sad * -0.014 * falloff(x, y, 0.58, 0.36, 0.06, 0.04);

  dy += pose.stern * 0.016 * falloff(x, y, 0.36, 0.37, 0.08, 0.045);
  dy += pose.stern * 0.016 * falloff(x, y, 0.64, 0.37, 0.08, 0.045);
  dx += pose.stern * 0.01 * falloff(x, y, 0.36, 0.37, 0.08, 0.045);
  dx += pose.stern * -0.01 * falloff(x, y, 0.64, 0.37, 0.08, 0.045);
  dy += pose.stern * 0.012 * (left + right);
  return [dx, dy];
};

export const createFace = (canvas) => {
  const gl = canvas.getContext('webgl', {alpha: false, antialias: true, premultipliedAlpha: false});
  if (!gl) return null;
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexShader));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentShader));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'link');
  gl.useProgram(program);

  const count = COLS * ROWS;
  const rest = new Float32Array(count * 2);
  const uv = new Float32Array(count * 2);
  const pos = new Float32Array(count * 2);
  let index = 0;
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const x = col / (COLS - 1);
      const y = row / (ROWS - 1);
      rest[index] = x;
      uv[index] = x;
      rest[index + 1] = y;
      uv[index + 1] = y;
      index += 2;
    }
  }
  const indices = new Uint16Array((COLS - 1) * (ROWS - 1) * 6);
  let triangle = 0;
  for (let row = 0; row < ROWS - 1; row += 1) {
    for (let col = 0; col < COLS - 1; col += 1) {
      const i = row * COLS + col;
      indices[triangle] = i;
      indices[triangle + 1] = i + 1;
      indices[triangle + 2] = i + COLS;
      indices[triangle + 3] = i + 1;
      indices[triangle + 4] = i + COLS + 1;
      indices[triangle + 5] = i + COLS;
      triangle += 6;
    }
  }

  const posBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
  const posLoc = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
  const uvLoc = gl.getAttribLocation(program, 'a_uv');
  gl.enableVertexAttribArray(uvLoc);
  gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  const uniform = (name) => gl.getUniformLocation(program, name);
  const uImage = uniform('u_image');
  const uOpen = uniform('u_open');
  const uRound = uniform('u_round');
  const uBlink = uniform('u_blink');
  const uSmile = uniform('u_smile');
  const uMouth = uniform('u_mouth');
  gl.uniform1i(uImage, 0);

  const pose = {smile: 0, sad: 0, surprise: 0, stern: 0, open: 0, round: 0};
  const target = {smile: 0, sad: 0, surprise: 0, stern: 0, open: 0, round: 0};
  let blink = 0;
  let blinkStarted = 0;
  let nextBlink = 1600;
  let ready = false;
  let last = 0;

  const approach = (key, dt) => {
    const speed = key === 'open' || key === 'round' ? 14 : 8;
    pose[key] += (target[key] - pose[key]) * (1 - Math.exp(-speed * dt));
  };

  return {
    setImage(image) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      ready = true;
    },
    setTarget(next) {
      for (const key of Object.keys(target)) target[key] = clamp(next[key] ?? target[key], 0, 1);
    },
    frame(now) {
      if (!ready) return;
      const dt = last ? clamp((now - last) / 1000, 0, 0.05) : 0.016;
      last = now;
      for (const key of Object.keys(pose)) approach(key, dt);
      if (now > nextBlink && blink <= 0) {
        blinkStarted = now;
        blink = 0.001;
        nextBlink = now + 2600 + Math.random() * 2800;
      }
      if (blink > 0) {
        const t = now - blinkStarted;
        if (t < 90) blink = t / 90;
        else if (t < 150) blink = 1;
        else if (t < 320) blink = 1 - (t - 150) / 170;
        else blink = 0;
      }

      const breath = 1 + Math.sin(now / 980) * 0.008;
      const sway = Math.sin(now / 1600) * 0.006;
      const tilt = Math.sin(now / 2100) * 0.018;
      const cos = Math.cos(tilt);
      const sin = Math.sin(tilt);
      for (let i = 0; i < count; i += 1) {
        const x0 = rest[i * 2];
        const y0 = rest[i * 2 + 1];
        const [mx, my] = displace(x0, y0, pose);
        let x = x0 + mx;
        let y = y0 + my;
        const cx = x - 0.5;
        const cy = y - 0.52;
        x = 0.5 + (cx * cos - cy * sin) * breath + sway;
        y = 0.52 + (cx * sin + cy * cos) * breath;
        pos[i * 2] = x;
        pos[i * 2 + 1] = y;
      }
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      let mouthX = MOUTH.x;
      let mouthY = MOUTH.y;
      let nearest = 1;
      for (let i = 0; i < count; i += 1) {
        const distance = Math.hypot(rest[i * 2] - MOUTH.x, rest[i * 2 + 1] - MOUTH.y);
        if (distance < nearest) {
          nearest = distance;
          mouthX = pos[i * 2];
          mouthY = pos[i * 2 + 1];
        }
      }
      gl.uniform1f(uOpen, pose.open);
      gl.uniform1f(uRound, pose.round);
      gl.uniform1f(uBlink, blink);
      gl.uniform1f(uSmile, pose.smile);
      gl.uniform2f(uMouth, mouthX, mouthY);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    },
  };
};

export const lipShape = {
  m: {open: 0, round: 0},
  a: {open: 0.72, round: 0.15},
  o: {open: 0.84, round: 0.92},
  i: {open: 0.34, round: 0.05},
};
