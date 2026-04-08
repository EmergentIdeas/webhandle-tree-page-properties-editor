import setup from "../initialize-webhandle-component.mjs"

export default async function startServer(webhandle) {
	webhandle.development = true	
	webhandle.routers.preStatic.use((req, res, next) => {
		req.user = {
			name: "administrator"
			, groups: ["administrators"]
		}
		
		next()
	})
	setup(webhandle)
}