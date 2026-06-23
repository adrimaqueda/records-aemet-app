import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [sveltekit()],
	// Solo afecta a `vite dev` en local: respeta PORT si está definido; si no, usa
	// el de Vite (5173). En Vercel no aplica (sirve la salida de adapter-vercel).
	server: { port: process.env.PORT ? Number(process.env.PORT) : undefined },
});
