// Nebula branding on the real Anura boot lifecycle, never a timed fake progress bar.
const bootsplash = (
	<div class="bootsplash nebula-boot" role="status" aria-live="polite">
		<div class="nebula-boot-stars" aria-hidden="true"></div>
		<div class="nebula-boot-emblem" aria-hidden="true">
			<div class="nebula-boot-halo"></div>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 160 160"
				width="160"
				height="160"
			>
				<circle class="nebula-boot-guide" cx="80" cy="80" r="70" />
				<path
					class="nebula-boot-monogram"
					pathLength="1"
					d="M53 107V53l54 54V53"
				/>
				<ellipse
					class="nebula-boot-ring"
					pathLength="1"
					cx="80"
					cy="80"
					rx="65"
					ry="24"
					transform="rotate(-32 80 80)"
				/>
			</svg>
			<div class="nebula-boot-satellite">
				<span></span>
			</div>
		</div>
		<h1>NebulaHub</h1>
		<p class="nebula-boot-caption">A little further into your universe.</p>
		<ol class="nebula-boot-stages" aria-label="Startup stages">
			<li>Storage</li>
			<li>Services</li>
			<li>Apps</li>
			<li>Desktop</li>
		</ol>
		<br id="systemstatus-br" style="display: none;" />
		<h2 id="systemstatus">Opening your filesystem…</h2>
	</div>
);
const bootsplashMobile = bootsplash;
const gangstaBootsplash = bootsplash;

function setNebulaBootStage(stage: number, message: string) {
	bootsplash.dataset.stage = String(stage);
	bootsplash
		.querySelectorAll(".nebula-boot-stages li")
		.forEach((step, index) => {
			step.classList.toggle("reached", index <= stage);
			if (index === stage) step.setAttribute("aria-current", "step");
			else step.removeAttribute("aria-current");
		});
	const status = bootsplash.querySelector("#systemstatus");
	if (status) status.textContent = message;
}
