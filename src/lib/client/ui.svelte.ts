export const ui = $state({
	profileOpen: false,
	mobileNav: false
});

export function openProfile(): void {
	ui.profileOpen = true;
}

export function closeProfile(): void {
	ui.profileOpen = false;
}

export function toggleMobileNav(open?: boolean): void {
	ui.mobileNav = open ?? !ui.mobileNav;
}
