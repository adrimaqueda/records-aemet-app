import adapter from "@sveltejs/adapter-vercel";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true),
	},
	kit: {
		// Despliegue en Vercel. La app es un SPA que lee los datos por fetch desde
		// HuggingFace en cliente: los shells estáticos (/, /datos, /metodologia) se
		// prerenderizan (ver src/routes/+layout.js) y /estacion/[indicativo] se
		// sirve por función serverless. Runtime por defecto (Node LTS de Vercel).
		adapter: adapter(),
	},
};

export default config;
