# Ionic Project README

## Setting up Xcode

To add a schema in Xcode for the Ionic project:

- Run `npx cap open ios` to open the project in Xcode.
- Select "App" in the project navigator.
- Go to the "Info" tab.
- Open the "URL Types" accordion.
- Click the `+` button to add a new URL type.
- Set both "Identifier" and "URL Schemes" to `strivacityionic.example`.

## Setting up Android

To add a schema in Android Studio for the Ionic project:

- Run `npx cap open android` to open the project in Android Studio.
- Navigate to the `manifests` folder under `app`.
- Open the `AndroidManifest.xml` file.
- Locate the `<activity>` tag for your main activity (usually with `android:name="MainActivity"`).
- Add the following inside the `<activity>` tag:
  ```xml
  <intent-filter>
      <action android:name="android.intent.action.VIEW" />
      <category android:name="android.intent.category.DEFAULT" />
      <category android:name="android.intent.category.BROWSABLE" />
      <data android:scheme="strivacityionic.example" />
  </intent-filter>
  ```
- Save the file and rebuild the project.

For further assistance, refer to the [Capacitor documentation](https://capacitorjs.com/docs/android) for Android-specific setup.
