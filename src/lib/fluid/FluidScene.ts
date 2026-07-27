import { FlipFluid } from "./FlipFluid";

export function setupFluidScene(
	simWidth: number,
	simHeight: number,
	resolution = 70,
	relWaterWidth = 0.6,
	relWaterHeight = 0.8,
	baseColor?: { r: number; g: number; b: number },
	foamColor?: { r: number; g: number; b: number },
	colorDiffusionCoeff = 0.0008,
	foamReturnRate = 0.5,
): FlipFluid {
	const h = simHeight / resolution;
	const r = 0.3 * h;
	const dx = 2.0 * r;
	const dy = Math.sqrt(3.0) / 2.0 * dx;
	const numX = Math.floor((relWaterWidth * simWidth - 2.0 * h - 2.0 * r) / dx);
	const numY = Math.floor((relWaterHeight * simHeight - 2.0 * h - 2.0 * r) / dy);
	const maxParticles = numX * numY;

	const fluid = new FlipFluid(1000.0, simWidth, simHeight, h, r, maxParticles, baseColor, foamColor, colorDiffusionCoeff, foamReturnRate);
	fluid.numParticles = numX * numY;

	const totalW = (numX - 1) * dx;
	const totalH = (numY - 1) * dy;
	const startX = (simWidth - totalW) / 2.0;
	const startY = (simHeight - totalH) / 2.0;

	let p = 0;
	for (let i = 0; i < numX; i++) {
		for (let j = 0; j < numY; j++) {
			fluid.particlePos[p++] = startX + dx * i + (j % 2 === 0 ? 0.0 : r);
			fluid.particlePos[p++] = startY + dy * j;
		}
	}

	const n = fluid.fNumY;
	for (let i = 0; i < fluid.fNumX; i++) {
		for (let j = 0; j < fluid.fNumY; j++) {
			fluid.s[i * n + j] = i === 0 || i === fluid.fNumX - 1 || j === 0 ? 0.0 : 1.0;
		}
	}

	return fluid;
}
