/**
 * afterSign hook: notarize the signed .app bundle with Apple.
 *
 * Required environment variables:
 *   APPLE_ID            — your Apple ID email
 *   APPLE_ID_PASSWORD   — app-specific password (NOT your real password)
 *   APPLE_TEAM_ID       — your 10-character Apple Developer Team ID
 *
 * To generate an app-specific password:
 *   1. Go to https://appleid.apple.com/account/manage
 *   2. Sign in → Security → App-Specific Passwords → Generate
 *   3. Name it "Dopl Connect Notarization" or similar
 *
 * Skip notarization in dev by setting SKIP_NOTARIZE=true
 */
const { notarize } = require('@electron/notarize');
const path = require('path');

module.exports = async function (context) {
  if (process.platform !== 'darwin') return;

  // Allow skipping in dev
  if (process.env.SKIP_NOTARIZE === 'true') {
    console.log('  • Skipping notarization (SKIP_NOTARIZE=true)');
    return;
  }

  const { APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID } = process.env;

  if (!APPLE_ID || !APPLE_ID_PASSWORD || !APPLE_TEAM_ID) {
    console.warn('  • Skipping notarization: missing APPLE_ID, APPLE_ID_PASSWORD, or APPLE_TEAM_ID');
    console.warn('    Set these env vars to enable notarization, or set SKIP_NOTARIZE=true to suppress this warning');
    return;
  }

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );

  console.log(`  • Notarizing ${appPath} ...`);
  console.log('    This usually takes 5-15 minutes.');

  await notarize({
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_ID_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });

  console.log('  • Notarization complete ✓');
};
