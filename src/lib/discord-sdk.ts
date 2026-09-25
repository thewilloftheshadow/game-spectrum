import type { DiscordSDK } from "@discord/embedded-app-sdk"

let discordSdk: DiscordSDK | null = null

export const setDiscordSdk = (sdk: DiscordSDK) => {
	discordSdk = sdk
}

export const getDiscordSdk = () => discordSdk
