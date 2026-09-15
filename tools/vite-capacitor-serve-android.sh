#!/bin/bash
set -euo pipefail

source .env

mode="${1:-run}"
app="${2:-}"
version=""
vite_arguments_start=3

if [[ -z "$app" ]]; then
	echo "Usage: $0 <run|production> <app> [vite arguments...]" >&2
	exit 1
fi

if [[ "$mode" != "run" && "$mode" != "production" ]]; then
	echo "Unknown mode: $mode" >&2
	exit 1
fi

if [[ "$mode" == "production" ]]; then
	version="${3:-}"
	vite_arguments_start=4

	if [[ -z "$version" || ! "$version" =~ ^[0-9A-Za-z][0-9A-Za-z._+-]*$ ]]; then
		echo "Usage: $0 production <app> <version> [vite arguments...]" >&2
		exit 1
	fi

	required_variables=(
		GRADLE_JDK
		ANDROID_HOME
		ANDROID_KEYSTORE_PATH
		ANDROID_KEYSTORE_PASSWORD
		ANDROID_KEY_ALIAS
		ANDROID_KEY_PASSWORD
	)

	for variable_name in "${required_variables[@]}"; do
		if [[ -z "${!variable_name:-}" ]]; then
			echo "Missing production signing variable: $variable_name" >&2
			exit 1
		fi
	done

	if [[ ! -f "$ANDROID_KEYSTORE_PATH" ]]; then
		echo "Android keystore not found: $ANDROID_KEYSTORE_PATH" >&2
		exit 1
	fi

	android_gradle_file="apps/$app/android/app/build.gradle"
	if [[ ! -f "$android_gradle_file" ]]; then
		echo "Android Gradle file not found: $android_gradle_file" >&2
		exit 1
	fi

	version_name_line_count="$(grep -cE '^[[:space:]]*versionName[[:space:]]+' "$android_gradle_file")"
	if [[ "$version_name_line_count" -ne 1 ]]; then
		echo "Expected exactly one versionName in $android_gradle_file" >&2
		exit 1
	fi

	sed -i -E "s/^([[:space:]]*versionName[[:space:]]+).*/\1\"$version\"/" "$android_gradle_file"
fi

echo "Building Android app '$app' in '$mode' mode"
cd "apps/$app"
npm install
if [[ "$mode" == "production" ]]; then
	VITE_APP_VERSION="$version" vite build "${@:vite_arguments_start}"
else
	vite build "${@:vite_arguments_start}"
fi
npx cap sync android

if [[ "$mode" == "production" ]]; then
	(
		cd android
		JAVA_HOME="$GRADLE_JDK" \
			ANDROID_HOME="$ANDROID_HOME" \
			ANDROID_KEYSTORE_PATH="$ANDROID_KEYSTORE_PATH" \
			ANDROID_KEYSTORE_PASSWORD="$ANDROID_KEYSTORE_PASSWORD" \
			ANDROID_KEY_ALIAS="$ANDROID_KEY_ALIAS" \
			ANDROID_KEY_PASSWORD="$ANDROID_KEY_PASSWORD" \
			./gradlew bundleRelease
	)
	echo "App Bundle: $PWD/android/app/build/outputs/bundle/release/app-release.aab"
elif [[ "$mode" == "run" ]]; then
	JAVA_HOME="$GRADLE_JDK" ANDROID_HOME="$ANDROID_HOME" ANDROID_JDK="${ANDROID_JDK:-}" npx cap run android
fi