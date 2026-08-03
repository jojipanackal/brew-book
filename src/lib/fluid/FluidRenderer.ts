import type { FlipFluid } from "./FlipFluid";

const pointVS = `
	attribute vec2 attrPosition;
	attribute vec3 attrColor;
	uniform vec2 domainSize;
	uniform float pointSize;
	uniform float drawDisk;
	varying vec3 fragColor;
	varying float fragDrawDisk;
	void main() {
		vec4 t = vec4(2.0 / domainSize.x, 2.0 / domainSize.y, -1.0, -1.0);
		gl_Position = vec4(attrPosition * t.xy + t.zw, 0.0, 1.0);
		gl_PointSize = pointSize;
		fragColor = attrColor;
		fragDrawDisk = drawDisk;
	}
`;

const pointFS = `
	precision mediump float;
	varying vec3 fragColor;
	varying float fragDrawDisk;
	void main() {
		if (fragDrawDisk == 1.0) {
			float r2 = dot(gl_PointCoord - 0.5, gl_PointCoord - 0.5);
			if (r2 > 0.25) discard;
			float alpha = 1.0 - smoothstep(0.15, 0.25, r2);
			gl_FragColor = vec4(fragColor, alpha * 0.85);
		} else {
			gl_FragColor = vec4(fragColor, 1.0);
		}
	}
`;

export interface RenderConfig {
	simWidth: number;
	simHeight: number;
}

export class FluidRenderer {
	private gl: WebGLRenderingContext;
	private shader: WebGLProgram;
	private posBuffer: WebGLBuffer;
	private colorBuffer: WebGLBuffer;

	constructor(canvas: HTMLCanvasElement) {
		const gl = canvas.getContext("webgl");
		if (!gl) throw new Error("WebGL not supported");
		this.gl = gl;
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		this.shader = this.compileShader(pointVS, pointFS);
		this.posBuffer = this.mkBuffer();
		this.colorBuffer = this.mkBuffer();
	}

	private compileShader(vs: string, fs: string): WebGLProgram {
		const gl = this.gl;
		const vert = gl.createShader(gl.VERTEX_SHADER)!;
		gl.shaderSource(vert, vs);
		gl.compileShader(vert);
		const frag = gl.createShader(gl.FRAGMENT_SHADER)!;
		gl.shaderSource(frag, fs);
		gl.compileShader(frag);
		const prog = gl.createProgram()!;
		gl.attachShader(prog, vert);
		gl.attachShader(prog, frag);
		gl.linkProgram(prog);
		return prog;
	}

	private mkBuffer(): WebGLBuffer {
		const b = this.gl.createBuffer();
		if (!b) throw new Error("Failed to create buffer");
		return b;
	}

	render(fluid: FlipFluid, config: RenderConfig): void {
		const gl = this.gl;
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.useProgram(this.shader);
		gl.uniform2f(gl.getUniformLocation(this.shader, "domainSize"), config.simWidth, config.simHeight);

		const pointSize = 5.0 * fluid.particleRadius / config.simWidth * gl.canvas.width;
		gl.uniform1f(gl.getUniformLocation(this.shader, "pointSize"), pointSize);
		gl.uniform1f(gl.getUniformLocation(this.shader, "drawDisk"), 1.0);

		const posLoc = gl.getAttribLocation(this.shader, "attrPosition");
		const colorLoc = gl.getAttribLocation(this.shader, "attrColor");
		gl.enableVertexAttribArray(posLoc);
		gl.enableVertexAttribArray(colorLoc);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, fluid.particlePos.subarray(0, 2 * fluid.numParticles), gl.DYNAMIC_DRAW);
		gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, fluid.particleColor.subarray(0, 3 * fluid.numParticles), gl.DYNAMIC_DRAW);
		gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

		gl.drawArrays(gl.POINTS, 0, fluid.numParticles);

		gl.disableVertexAttribArray(posLoc);
		gl.disableVertexAttribArray(colorLoc);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);
	}

	resize(width: number, height: number): void {
		const canvas = this.gl.canvas as HTMLCanvasElement;
		canvas.width = width;
		canvas.height = height;
		this.gl.viewport(0, 0, width, height);
	}
}
