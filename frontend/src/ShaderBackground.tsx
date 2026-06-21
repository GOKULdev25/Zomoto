import React, { useEffect, useRef } from 'react';

export const ShaderBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function syncSize() {
      const w = canvas!.clientWidth || 1280;
      const h = canvas!.clientHeight || 720;
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
      }
    }

    const observer = new ResizeObserver(syncSize);
    observer.observe(canvas);
    syncSize();

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;

    const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

    const fs = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    
    // Top-left: red/crimson radial blob
    float d1 = distance(uv, vec2(0.2, 0.8) + 0.1 * vec2(sin(u_time * 0.5), cos(u_time * 0.4)));
    float blob1 = smoothstep(0.6, 0.0, d1) * 0.07;
    vec3 col1 = vec3(0.886, 0.216, 0.267) * blob1;

    // Top-right: warm orange radial blob
    float d2 = distance(uv, vec2(0.8, 0.7) + 0.12 * vec2(cos(u_time * 0.6), sin(u_time * 0.3)));
    float blob2 = smoothstep(0.5, 0.0, d2) * 0.05;
    vec3 col2 = vec3(1.0, 0.42, 0.208) * blob2;

    // Bottom-center: muted purple radial blob
    float d3 = distance(uv, vec2(0.5, 0.2) + 0.08 * vec2(sin(u_time * 0.4), sin(u_time * 0.7)));
    float blob3 = smoothstep(0.7, 0.0, d3) * 0.04;
    vec3 col3 = vec3(0.392, 0.196, 0.588) * blob3;

    vec3 finalColor = vec3(0.051, 0.051, 0.051) + col1 + col2 + col3;
    gl_FragColor = vec4(finalColor, 1.0);
}`;

    function cs(type: number, src: string) {
      const s = (gl as WebGLRenderingContext).createShader(type);
      if (!s) return null;
      (gl as WebGLRenderingContext).shaderSource(s, src);
      (gl as WebGLRenderingContext).compileShader(s);
      return s;
    }

    const prog = (gl as WebGLRenderingContext).createProgram();
    if (!prog) return;

    const vsShader = cs((gl as WebGLRenderingContext).VERTEX_SHADER, vs);
    const fsShader = cs((gl as WebGLRenderingContext).FRAGMENT_SHADER, fs);
    if (!vsShader || !fsShader) return;

    (gl as WebGLRenderingContext).attachShader(prog, vsShader);
    (gl as WebGLRenderingContext).attachShader(prog, fsShader);
    (gl as WebGLRenderingContext).linkProgram(prog);
    (gl as WebGLRenderingContext).useProgram(prog);

    const buf = (gl as WebGLRenderingContext).createBuffer();
    (gl as WebGLRenderingContext).bindBuffer((gl as WebGLRenderingContext).ARRAY_BUFFER, buf);
    (gl as WebGLRenderingContext).bufferData((gl as WebGLRenderingContext).ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), (gl as WebGLRenderingContext).STATIC_DRAW);

    const pos = (gl as WebGLRenderingContext).getAttribLocation(prog, 'a_position');
    (gl as WebGLRenderingContext).enableVertexAttribArray(pos);
    (gl as WebGLRenderingContext).vertexAttribPointer(pos, 2, (gl as WebGLRenderingContext).FLOAT, false, 0, 0);

    const uTime = (gl as WebGLRenderingContext).getUniformLocation(prog, 'u_time');
    const uRes = (gl as WebGLRenderingContext).getUniformLocation(prog, 'u_resolution');

    let animationFrameId: number;

    function render(t: number) {
      if (canvas) {
        (gl as WebGLRenderingContext).viewport(0, 0, canvas.width, canvas.height);
        if (uTime) (gl as WebGLRenderingContext).uniform1f(uTime, t * 0.001);
        if (uRes) (gl as WebGLRenderingContext).uniform2f(uRes, canvas.width, canvas.height);
        (gl as WebGLRenderingContext).drawArrays((gl as WebGLRenderingContext).TRIANGLE_STRIP, 0, 4);
      }
      animationFrameId = requestAnimationFrame(render);
    }
    render(0);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
      <div className="absolute inset-0 w-full h-full" style={{ display: 'block' }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }}></canvas>
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 to-background"></div>
    </div>
  );
};
