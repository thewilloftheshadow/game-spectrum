import { ratingFields } from "~/lib/scoring"
import ui from "~/styles/ui.module.css"
import styles from "./about.module.css"

const sheetCopy = `The point of this is to create your own list of games and give them scores. The final score has NOTHING with being a "4/10" or "7.5/10", but rather creating a list to rank the games you have played on which is your fav to least fav.

The reason behind this style of ranking is that number on a list for games mean nothing personal. Just because 5 companies rank 1 game a 7/10 might not mean it speaks to YOU. 

I hope to create a community around persoanlized bio's and lists so people who enjoy puzzle games will be able to look at others similar to them and see their favorite games stack up to new ones. This also allows others to check out new games. If you normally only related with "X" reviewer because they like action games, and they REALLY enjoy a new puzzle game, you will be more likley to give that game a try now.

It doesn't matter if you have played 2 games or 100, everyone deserves to have their list formed to educate others and helping them choose the next game to play! The plan right now is a small community on discord --> https://discord.gg/tHCMX7Y7y3 | But I would love to expand this to a website or video series on games and more media.

GUIDE
- If you use decimals, please only to 1 digit. EX. 5.2 or 7.1, NOT 6.32. Be ready for the calculation to break also LOL but thats oki
- The final score will not populate untill you have filled out all of them including the Bonus section
- `

export default function AboutPage() {
	return (
		<main id="main" className={`${ui.page} ${ui.narrow}`}>
			<h1 className={ui.title}>About Game Spectrum</h1>
			<article className={styles.copy}>{sheetCopy}</article>
			<a
				className={styles.source}
				href="https://docs.google.com/spreadsheets/d/1MugtKKstOsAb4GIhY6PnukJuGBZXb0C7dQjnZiFgrT0/edit"
				target="_blank"
				rel="noreferrer"
			>
				Original spreadsheet ↗
			</a>
			<section className={styles.scoring} aria-labelledby="scoring-title">
				<h2 id="scoring-title">Scoring</h2>
				{[...new Set(ratingFields.map((field) => field.group))].map(
					(group) => {
						const fields = ratingFields.filter(
							(field) => field.group === group
						)
						return (
							<section key={group}>
								<h3>
									{group}
									{group === "Bonus"
										? ""
										: ` / ${fields.reduce((sum, field) => sum + field.max, 0)}`}
								</h3>
								<dl>
									{fields.map((field) => (
										<div key={field.key}>
											<dt>
												{field.label}
												<span>
													{field.key ===
													"extraPercent"
														? "10%"
														: field.max}
												</span>
											</dt>
											<dd>{field.description}</dd>
										</div>
									))}
								</dl>
							</section>
						)
					}
				)}
				<h3>Final score</h3>
				<p className={styles.formula}>
					(Base − Penalties + Replayability) × (1 + Extra % ÷ 100)
				</p>
				<p>
					Base categories total 100 points. Penalties subtract up to
					35 points. Replayability adds up to 10 points; Extra %
					increases the result by up to 10%. Use 0% for no extra
					bonus.
				</p>
				<p>
					Scores accept one decimal place. A game stays unrated until
					every field is filled, including zero penalties and bonuses.
					Hidden and unrated games do not appear on public profiles.
				</p>
			</section>
		</main>
	)
}
