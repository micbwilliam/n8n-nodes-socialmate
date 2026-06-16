const { src, dest } = require('gulp');

// Copies node/credential SVG icons into dist alongside the compiled JS so n8n
// can resolve the `icon: 'file:socialmate.svg'` references at runtime.
function buildIcons() {
	return src('nodes/**/*.{png,svg}', { base: '.' }).pipe(dest('dist'));
}

exports['build:icons'] = buildIcons;
