"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAspectSize = exports.falImageSizeMap = void 0;
exports.falImageSizeMap = {
    "1:1": { width: 1024, height: 1024, imageSize: "square" },
    "4:3": { width: 1200, height: 900, imageSize: "landscape_4_3" },
    "3:4": { width: 900, height: 1200, imageSize: "portrait_4_3" },
    "4:5": { width: 960, height: 1200, imageSize: "portrait_4_3" },
    "16:9": { width: 1344, height: 756, imageSize: "landscape_16_9" },
    "9:16": { width: 756, height: 1344, imageSize: "portrait_16_9" },
};
var resolveAspectSize = function (aspect, sizeMap, fallbackAspect) {
    if (aspect && sizeMap[aspect])
        return sizeMap[aspect];
    if (sizeMap[fallbackAspect])
        return sizeMap[fallbackAspect];
    var first = Object.values(sizeMap)[0];
    return first !== null && first !== void 0 ? first : null;
};
exports.resolveAspectSize = resolveAspectSize;
