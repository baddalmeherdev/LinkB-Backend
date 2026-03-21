let withMainActivity;
try {
  const cp = require('@expo/config-plugins');
  withMainActivity = cp.withMainActivity;
} catch (e) {
  const expoDir = require.resolve('expo/package.json').replace('/package.json', '');
  const cp = require(require.resolve('@expo/config-plugins', { paths: [expoDir] }));
  withMainActivity = cp.withMainActivity;
}

/**
 * Plugin that patches MainActivity so that when the app is opened via
 * Android's "Share" sheet with a plain-text URL, the URL is extracted
 * from Intent.EXTRA_TEXT and forwarded to Expo Router as a deep link.
 */
module.exports = function withShareIntent(config) {
  return withMainActivity(config, (mod) => {
    let contents = mod.modResults.contents;
    const isKotlin = mod.modResults.language === 'kt';

    // Guard: already patched
    if (contents.includes('handleShareIntent')) {
      return mod;
    }

    if (isKotlin) {
      // 1. Ensure imports
      const importsToAdd = [
        'import android.content.Intent',
        'import android.net.Uri',
      ];
      for (const imp of importsToAdd) {
        if (!contents.includes(imp)) {
          contents = contents.replace(
            /^(package .+?\n)/m,
            `$1${imp}\n`
          );
        }
      }

      // 2. The helper method + onNewIntent override
      const helperMethod = `
  private fun handleShareIntent(intent: Intent?) {
    intent ?: return
    if (intent.action == Intent.ACTION_SEND && intent.type == "text/plain") {
      val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return
      val urlRegex = Regex("""https?://[^\\s]+""")
      val url = urlRegex.find(sharedText)?.value ?: if (sharedText.startsWith("http")) sharedText else return
      val deepLink = Uri.parse("linkbdownloader://").buildUpon()
        .appendQueryParameter("autoUrl", url)
        .build()
      this.intent = Intent(Intent.ACTION_VIEW, deepLink)
    }
  }

  override fun onNewIntent(intent: Intent?) {
    handleShareIntent(intent)
    super.onNewIntent(intent)
  }
`;

      // 3. Insert helper before onCreate
      contents = contents.replace(
        /(\s*override fun onCreate\(savedInstanceState: Bundle\?\))/,
        `${helperMethod}$1`
      );

      // 4. Call handleShareIntent at the start of onCreate
      contents = contents.replace(
        /override fun onCreate\(savedInstanceState: Bundle\?\)\s*\{/,
        `override fun onCreate(savedInstanceState: Bundle?) {\n    handleShareIntent(intent)`
      );
    } else {
      // Java path
      const importsToAdd = [
        'import android.content.Intent;',
        'import android.net.Uri;',
      ];
      for (const imp of importsToAdd) {
        if (!contents.includes(imp)) {
          contents = contents.replace(
            /import com\.facebook\.react\.ReactActivity;/,
            `import com.facebook.react.ReactActivity;\n${imp}`
          );
        }
      }

      const helperMethod = `
  private void handleShareIntent(Intent intent) {
    if (intent == null) return;
    if (Intent.ACTION_SEND.equals(intent.getAction()) && "text/plain".equals(intent.getType())) {
      String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
      if (sharedText == null || sharedText.isEmpty()) return;
      String url = null;
      java.util.regex.Matcher m = java.util.regex.Pattern.compile("https?://[^\\\\s]+").matcher(sharedText);
      if (m.find()) { url = m.group(); }
      else if (sharedText.startsWith("http")) { url = sharedText; }
      if (url == null) return;
      Uri deepLink = Uri.parse("linkbdownloader://").buildUpon()
        .appendQueryParameter("autoUrl", url)
        .build();
      setIntent(new Intent(Intent.ACTION_VIEW, deepLink));
    }
  }

  @Override
  public void onNewIntent(Intent intent) {
    handleShareIntent(intent);
    super.onNewIntent(intent);
  }
`;

      contents = contents.replace(
        /(\s*@Override\s*protected void onCreate\(Bundle savedInstanceState\))/,
        `${helperMethod}$1`
      );

      contents = contents.replace(
        /@Override\s*protected void onCreate\(Bundle savedInstanceState\)\s*\{/,
        `@Override\n  protected void onCreate(Bundle savedInstanceState) {\n    handleShareIntent(getIntent());`
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });
};
