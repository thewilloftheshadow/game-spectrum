export const ratingFields = [
	{
		key: "funFeeling",
		label: "Fun / Feeling",
		group: "Mechanics",
		max: 10,
		description: "How good the moment-to-moment play feels."
	},
	{
		key: "immersive",
		label: "Immersive",
		group: "Mechanics",
		max: 10,
		description: "How well the game pulls you into its world or loop."
	},
	{
		key: "variety",
		label: "Variety",
		group: "Mechanics",
		max: 5,
		description: "How well the mechanics avoid repetition."
	},
	{
		key: "artistry",
		label: "Artistry",
		group: "Visuals",
		max: 15,
		description:
			"Art direction, visual identity, and memorable presentation."
	},
	{
		key: "ui",
		label: "UI",
		group: "Visuals",
		max: 5,
		description: "Menus, HUD, readability, and visual usability."
	},
	{
		key: "narrationTheme",
		label: "Narration / Theme",
		group: "Personality",
		max: 15,
		description:
			"Story, themes, tone, and how the game communicates meaning."
	},
	{
		key: "authenticity",
		label: "Authenticity",
		group: "Personality",
		max: 5,
		description: "How sincere and confident the game feels in what it is."
	},
	{
		key: "originality",
		label: "Originality",
		group: "Personality",
		max: 10,
		description: "Freshness of ideas and identity."
	},
	{
		key: "music",
		label: "Music",
		group: "Audio",
		max: 5,
		description: "Soundtrack quality and fit."
	},
	{
		key: "effectsVocals",
		label: "Effects / Vocals",
		group: "Audio",
		max: 5,
		description: "Sound effects, voice work, and audio texture."
	},
	{
		key: "interfaceScore",
		label: "Interface",
		group: "Control",
		max: 5,
		description: "How clearly the game communicates inputs and state."
	},
	{
		key: "control",
		label: "Control",
		group: "Control",
		max: 5,
		description: "Responsiveness and comfort of controlling the game."
	},
	{
		key: "learningCurve",
		label: "Learning Curve",
		group: "Control",
		max: 5,
		description: "How well the game teaches and ramps complexity."
	},
	{
		key: "performancePenalty",
		label: "Performance",
		group: "Penalties",
		max: 20,
		description: "Subtract for bugs, crashes, stutter, or technical issues."
	},
	{
		key: "badMomentPenalty",
		label: "Bad Moment",
		group: "Penalties",
		max: 5,
		description: "Subtract for standout moments that hurt the experience."
	},
	{
		key: "inconsistencyPenalty",
		label: "Inconsistency",
		group: "Penalties",
		max: 10,
		description: "Subtract when quality swings hard across the game."
	},
	{
		key: "replayabilityBonus",
		label: "Replayability",
		group: "Bonus",
		max: 10,
		description:
			"Bonus for wanting to replay, revisit, or keep experimenting."
	},
	{
		key: "extraPercent",
		label: "Extra %",
		group: "Bonus",
		max: 1.1,
		description:
			"Percentage added to the total after penalties and replayability, up to 10%."
	}
] as const

export const scoreKeys = ratingFields.map((field) => field.key)

export function calculateScore(entry: Record<string, unknown>) {
	if (
		scoreKeys.some(
			(key) =>
				typeof entry[key] !== "number" || !Number.isFinite(entry[key])
		)
	) {
		return null
	}

	const positiveTotal =
		(entry.funFeeling as number) +
		(entry.immersive as number) +
		(entry.variety as number) +
		(entry.artistry as number) +
		(entry.ui as number) +
		(entry.narrationTheme as number) +
		(entry.authenticity as number) +
		(entry.originality as number) +
		(entry.music as number) +
		(entry.effectsVocals as number) +
		(entry.interfaceScore as number) +
		(entry.control as number) +
		(entry.learningCurve as number)
	const penaltyTotal =
		(entry.performancePenalty as number) +
		(entry.badMomentPenalty as number) +
		(entry.inconsistencyPenalty as number)
	const raw =
		(positiveTotal - penaltyTotal + (entry.replayabilityBonus as number)) *
		(entry.extraPercent as number)

	return Math.round(raw * 10) / 10
}

export function oneDecimal(value: unknown) {
	if (value === null || value === undefined || value === "") {
		return null
	}
	const number = Number(value)
	if (!Number.isFinite(number)) {
		return null
	}
	return Math.round(number * 10) / 10
}
