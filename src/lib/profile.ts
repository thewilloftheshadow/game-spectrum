import type { getMyProfile } from "~/server/api/profile"
import { apiQueryOptions } from "./api-client"

export const myProfileQuery = apiQueryOptions<{
	data: Awaited<ReturnType<typeof getMyProfile>>
}>(["me"], "me")
