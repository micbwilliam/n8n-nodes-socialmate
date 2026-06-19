const { src, dest } = require('gulp');

// Copies node/credential SVG icons AND the `*.node.json` codex files into dist
// alongside the compiled JS so n8n can resolve the `icon: 'file:socialmate.svg'`
// references and the node codex (categories, documentation links) at runtime.
function buildIcons() {
	return src(['nodes/**/*.{png,svg,json}', 'credentials/**/*.{png,svg}'], { base: '.' }).pipe(
		dest('dist'),
	);
}

exports['build:icons'] = buildIcons;
