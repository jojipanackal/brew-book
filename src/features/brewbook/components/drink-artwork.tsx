import { useState } from "react";
import type { Drink } from "#/lib/drinks";

const artwork: Record<Drink, string> = {
	Tea: "tea",
	Coffee: "coffee",
	"Green tea": "green-tea",
	Milk: "milk",
	"Black Coffee": "coffee",
	"Black Tea": "tea",
	"No drink": "pause",
};

/** The sentence is the accessible source of truth; this image is decorative. */
export function DrinkArtwork({ drink, away }: { drink: Drink; away: boolean }) {
	const name = away ? "pause" : artwork[drink];
	return (
		<div className="drink-artwork" aria-hidden="true">
			<ArtworkImage key={name} name={name} />
		</div>
	);
}

function ArtworkImage({ name }: { name: string }) {
	const [failed, setFailed] = useState(false);
	if (failed) return null;
	return (
		<img
			src={`/artwork/${name}.webp`}
			alt=""
			width={600}
			height={400}
			decoding="async"
			draggable={false}
			onError={() => setFailed(true)}
		/>
	);
}
