// Groups model variants under one base "kind" — e.g. "iPhone 15 Pro Max"
// and "iPhone 15 Pro" both collapse to "iPhone 15" — so filtering by kind
// shows every variant of that generation together.
export function getDeviceKind(deviceName) {
  if (!deviceName) return deviceName;
  return deviceName
    .replace(/ Pro Max$/, "")
    .replace(/ Pro$/, "")
    .replace(/ Plus$/, "")
    .replace(/ Max$/, "");
}
