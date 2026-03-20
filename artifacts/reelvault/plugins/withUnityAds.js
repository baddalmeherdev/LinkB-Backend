let withAppBuildGradle, withMainApplication, withDangerousMod;
try {
  const cp = require('@expo/config-plugins');
  withAppBuildGradle = cp.withAppBuildGradle;
  withMainApplication = cp.withMainApplication;
  withDangerousMod = cp.withDangerousMod;
} catch (e) {
  // Try resolving from the expo package which always has config-plugins as a dep
  const expoDir = require.resolve('expo/package.json').replace('/package.json', '');
  const cp = require(require.resolve('@expo/config-plugins', { paths: [expoDir] }));
  withAppBuildGradle = cp.withAppBuildGradle;
  withMainApplication = cp.withMainApplication;
  withDangerousMod = cp.withDangerousMod;
}
const fs = require('fs');
const path = require('path');

const UNITY_ADS_VERSION = '4.12.5';
const PACKAGE_NAME = 'com.badalmeher.linkbdownloader';

const UNITY_MODULE_JAVA = `package ${PACKAGE_NAME};

import android.app.Activity;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import com.unity3d.ads.IUnityAdsInitializationListener;
import com.unity3d.ads.IUnityAdsLoadListener;
import com.unity3d.ads.IUnityAdsShowListener;
import com.unity3d.ads.UnityAds;
import com.unity3d.ads.UnityAdsShowOptions;

public class RNUnityAdsModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "RNUnityAds";
    private final ReactApplicationContext reactContext;

    public RNUnityAdsModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    @NonNull
    public String getName() {
        return MODULE_NAME;
    }

    private void sendEvent(String eventName, @Nullable WritableMap params) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(eventName, params);
        }
    }

    @ReactMethod
    public void initialize(String gameId, boolean testMode) {
        Activity activity = getCurrentActivity();
        if (activity == null) return;
        UnityAds.initialize(activity.getApplication(), gameId, testMode, new IUnityAdsInitializationListener() {
            @Override
            public void onInitializationComplete() {
                WritableMap params = Arguments.createMap();
                params.putBoolean("success", true);
                sendEvent("unityAdsInitialized", params);
            }
            @Override
            public void onInitializationFailed(UnityAds.UnityAdsInitializationError error, String message) {
                WritableMap params = Arguments.createMap();
                params.putBoolean("success", false);
                params.putString("message", message != null ? message : error.name());
                sendEvent("unityAdsInitialized", params);
            }
        });
    }

    @ReactMethod
    public void load(String placementId) {
        UnityAds.load(placementId, new IUnityAdsLoadListener() {
            @Override
            public void onUnityAdsAdLoaded(String pid) {
                WritableMap params = Arguments.createMap();
                params.putString("placementId", pid);
                params.putBoolean("loaded", true);
                sendEvent("unityAdsLoaded", params);
            }
            @Override
            public void onUnityAdsFailedToLoad(String pid, UnityAds.UnityAdsLoadError error, String message) {
                WritableMap params = Arguments.createMap();
                params.putString("placementId", pid);
                params.putBoolean("loaded", false);
                params.putString("message", message != null ? message : error.name());
                sendEvent("unityAdsLoaded", params);
            }
        });
    }

    @ReactMethod
    public void show(String placementId) {
        Activity activity = getCurrentActivity();
        if (activity == null) {
            WritableMap params = Arguments.createMap();
            params.putString("placementId", placementId);
            params.putString("state", "ERROR");
            sendEvent("unityAdsFinished", params);
            return;
        }
        UnityAds.show(activity, placementId, new UnityAdsShowOptions(), new IUnityAdsShowListener() {
            @Override
            public void onUnityAdsShowStart(String pid) {
                WritableMap params = Arguments.createMap();
                params.putString("placementId", pid);
                sendEvent("unityAdsStarted", params);
            }
            @Override
            public void onUnityAdsShowClick(String pid) {}
            @Override
            public void onUnityAdsShowComplete(String pid, UnityAds.UnityAdsShowCompletionState state) {
                WritableMap params = Arguments.createMap();
                params.putString("placementId", pid);
                params.putString("state", state.name());
                sendEvent("unityAdsFinished", params);
            }
            @Override
            public void onUnityAdsShowFailure(String pid, UnityAds.UnityAdsShowError error, String message) {
                WritableMap params = Arguments.createMap();
                params.putString("placementId", pid);
                params.putString("state", "ERROR");
                params.putString("message", message != null ? message : error.name());
                sendEvent("unityAdsFinished", params);
            }
        });
    }

    @ReactMethod
    public void addListener(String eventName) {}

    @ReactMethod
    public void removeListeners(double count) {}
}
`;

const UNITY_PACKAGE_JAVA = `package ${PACKAGE_NAME};

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class RNUnityAdsPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new RNUnityAdsModule(reactContext));
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
`;

function withUnityAdsDependency(config) {
    return withAppBuildGradle(config, (mod) => {
        const dep = `    implementation 'com.unity3d.ads:unity-ads:${UNITY_ADS_VERSION}'`;
        if (!mod.modResults.contents.includes('com.unity3d.ads:unity-ads')) {
            mod.modResults.contents = mod.modResults.contents.replace(
                /dependencies\s*\{/,
                `dependencies {\n${dep}`
            );
        }
        return mod;
    });
}

function withUnityAdsJavaFiles(config) {
    return withDangerousMod(config, [
        'android',
        (mod) => {
            const packagePath = PACKAGE_NAME.split('.').join(path.sep);
            const srcDir = path.join(
                mod.modRequest.platformProjectRoot,
                'app', 'src', 'main', 'java',
                packagePath
            );
            fs.mkdirSync(srcDir, { recursive: true });

            const modulePath = path.join(srcDir, 'RNUnityAdsModule.java');
            const pkgPath = path.join(srcDir, 'RNUnityAdsPackage.java');

            fs.writeFileSync(modulePath, UNITY_MODULE_JAVA);
            fs.writeFileSync(pkgPath, UNITY_PACKAGE_JAVA);
            return mod;
        },
    ]);
}

function withUnityAdsMainApplication(config) {
    return withMainApplication(config, (mod) => {
        let contents = mod.modResults.contents;

        if (contents.includes('RNUnityAdsPackage')) {
            return mod;
        }

        const isKotlin = mod.modResults.language === 'kt';

        if (isKotlin) {
            if (!contents.includes(`import ${PACKAGE_NAME}.RNUnityAdsPackage`)) {
                contents = contents.replace(
                    /^(package .+?\n)/m,
                    `$1import ${PACKAGE_NAME}.RNUnityAdsPackage\n`
                );
            }
            contents = contents.replace(
                /PackageList\(this\)\.packages/,
                `PackageList(this).packages.apply { add(RNUnityAdsPackage()) }`
            );
            if (!contents.includes('RNUnityAdsPackage')) {
                contents = contents.replace(
                    /return packages/,
                    `packages.add(RNUnityAdsPackage())\n    return packages`
                );
            }
        } else {
            if (!contents.includes(`import ${PACKAGE_NAME}.RNUnityAdsPackage;`)) {
                contents = contents.replace(
                    /import com\.facebook\.react\.ReactApplication;/,
                    `import com.facebook.react.ReactApplication;\nimport ${PACKAGE_NAME}.RNUnityAdsPackage;`
                );
            }
            contents = contents.replace(
                /new PackageList\(this\)\.getPackages\(\);/,
                `new PackageList(this).getPackages();\n            packages.add(new RNUnityAdsPackage());`
            );
            if (!contents.includes('RNUnityAdsPackage')) {
                contents = contents.replace(
                    /return packages;/,
                    `packages.add(new RNUnityAdsPackage());\n            return packages;`
                );
            }
        }

        mod.modResults.contents = contents;
        return mod;
    });
}

module.exports = function withUnityAds(config) {
    config = withUnityAdsDependency(config);
    config = withUnityAdsJavaFiles(config);
    config = withUnityAdsMainApplication(config);
    return config;
};
