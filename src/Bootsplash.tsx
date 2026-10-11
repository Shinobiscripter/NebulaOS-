// Nebula branding on the real Anura boot lifecycle, never a timed fake progress bar.
const bootsplash = (
	<div class="bootsplash nebula-boot" role="status" aria-live="polite">
		<img src="/nebula/icon.svg" alt="" width="92" height="92" />
		<h1>NebulaHub</h1>
		<p class="nebula-boot-caption">Your space. Ready to explore.</p>
		<div class="nebula-boot-orbit" aria-hidden="true"></div>
		<br id="systemstatus-br" style="display: none;" />
		<h2 id="systemstatus">Initializing your desktop…</h2>
	</div>
);
const bootsplashMobile = bootsplash;
const gangstaBootsplash = bootsplash;
