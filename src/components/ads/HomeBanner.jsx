// HomeBanner — kept as a stable import name for Home.jsx. The implementation
// now lives in the generic AdBanner (also mounted on the finder pages via
// Layout). Behavior on Home is unchanged: an adaptive AdMob banner pinned to
// the bottom edge, with FloatingNav lifted above it (Layout's liftForAd).
export { default } from './AdBanner';
