import posthog from "posthog-js"

type LogAttributes = Record<string, boolean | number | string>

export const posthogLogger = {
	info(message: string, attributes: LogAttributes) {
		if (
			import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN &&
			import.meta.env.VITE_PUBLIC_POSTHOG_HOST
		)
			posthog.logger.info(message, attributes)
	}
}
