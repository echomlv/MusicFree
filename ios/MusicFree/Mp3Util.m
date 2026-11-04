#import <AVFoundation/AVFoundation.h>
#import <CommonCrypto/CommonDigest.h>
#import <React/RCTBridgeModule.h>
#import <math.h>

// AVFoundation metadata reading follows the approach used by LX Music's iOS port.
// https://github.com/lyswhut/lx-music-mobile (Apache-2.0)
@interface Mp3Util : NSObject <RCTBridgeModule>
@end

@implementation Mp3Util

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup { return NO; }

- (dispatch_queue_t)methodQueue {
  static dispatch_queue_t queue;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{ queue = dispatch_queue_create("musicfree.metadata", DISPATCH_QUEUE_SERIAL); });
  return queue;
}

static NSURL *MediaURL(NSString *path) {
  return [path hasPrefix:@"file://"] ? [NSURL URLWithString:path] : [NSURL fileURLWithPath:path];
}

static NSArray<AVMetadataItem *> *MetadataItems(AVAsset *asset) {
  NSMutableArray *items = [NSMutableArray arrayWithArray:asset.commonMetadata ?: @[]];
  for (AVMetadataFormat format in asset.availableMetadataFormats) {
    [items addObjectsFromArray:[asset metadataForFormat:format]];
  }
  return items;
}

static NSString *MetadataString(AVAsset *asset, NSArray<NSString *> *keys) {
  for (AVMetadataItem *item in MetadataItems(asset)) {
    NSString *identifier = item.identifier.lowercaseString ?: @"";
    for (NSString *key in keys) {
      if ([item.commonKey.lowercaseString isEqualToString:key] || [identifier containsString:key]) {
        NSString *value = item.stringValue;
        if (value.length) return value;
      }
    }
  }
  return @"";
}

static NSDictionary *ReadBasicMetadata(NSString *path) {
  NSURL *url = MediaURL(path);
  AVURLAsset *asset = [AVURLAsset URLAssetWithURL:url options:nil];
  Float64 seconds = CMTimeGetSeconds(asset.duration);
  NSString *title = MetadataString(asset, @[@"title", @"tit2"]);
  NSMutableDictionary *metadata = [@{
    @"title": title.length ? title : url.URLByDeletingPathExtension.lastPathComponent,
    // The existing JS contract expects milliseconds, not AVFoundation seconds.
    @"duration": [NSString stringWithFormat:@"%.0f", isfinite(seconds) && seconds > 0 ? seconds * 1000 : 0],
  } mutableCopy];
  NSDictionary *fields = @{
    @"artist": MetadataString(asset, @[@"artist", @"creator", @"tpe1"]),
    @"album": MetadataString(asset, @[@"albumname", @"album", @"talb"]),
    @"author": MetadataString(asset, @[@"author", @"composer"]),
  };
  for (NSString *key in fields) {
    if ([fields[key] length]) metadata[key] = fields[key];
  }
  return metadata;
}

RCT_REMAP_METHOD(getBasicMeta, getBasicMeta:(NSString *)path resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  if (![[NSFileManager defaultManager] fileExistsAtPath:MediaURL(path).path]) {
    reject(@"file_not_found", @"Audio file does not exist", nil);
    return;
  }
  resolve(ReadBasicMetadata(path));
}

RCT_REMAP_METHOD(getMediaMeta, getMediaMeta:(NSArray<NSString *> *)paths resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSMutableArray *results = [NSMutableArray arrayWithCapacity:paths.count];
  for (NSString *path in paths) {
    [results addObject:[[NSFileManager defaultManager] fileExistsAtPath:MediaURL(path).path]
      ? ReadBasicMetadata(path) : (id)[NSNull null]];
  }
  resolve(results);
}

RCT_REMAP_METHOD(getMediaCoverImg, getMediaCoverImg:(NSString *)path resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSURL *url = MediaURL(path);
  AVURLAsset *asset = [AVURLAsset URLAssetWithURL:url options:nil];
  NSData *artwork = nil;
  for (AVMetadataItem *item in MetadataItems(asset)) {
    NSString *identifier = item.identifier.lowercaseString ?: @"";
    if ([item.commonKey isEqualToString:AVMetadataCommonKeyArtwork] ||
        [identifier containsString:@"artwork"] || [identifier containsString:@"apic"] ||
        [identifier containsString:@"covr"]) {
      artwork = item.dataValue;
      if (!artwork && [item.value isKindOfClass:[NSDictionary class]]) artwork = ((NSDictionary *)item.value)[@"data"];
      if (artwork.length) break;
    }
  }
  if (!artwork.length) { resolve(@""); return; }

  NSString *cache = [NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES).firstObject
    stringByAppendingPathComponent:@"musicfree-artwork"];
  NSError *error = nil;
  [[NSFileManager defaultManager] createDirectoryAtPath:cache withIntermediateDirectories:YES attributes:nil error:&error];
  NSData *pathData = [url.path dataUsingEncoding:NSUTF8StringEncoding];
  unsigned char digest[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256(pathData.bytes, (CC_LONG)pathData.length, digest);
  NSMutableString *filename = [NSMutableString string];
  for (NSUInteger i = 0; i < sizeof(digest); i++) [filename appendFormat:@"%02x", digest[i]];
  NSString *target = [cache stringByAppendingPathComponent:filename];
  if (error || ![artwork writeToFile:target options:NSDataWritingAtomic error:&error]) {
    reject(@"cover_write_failed", error.localizedDescription, error);
    return;
  }
  resolve([NSURL fileURLWithPath:target].absoluteString);
}

RCT_REMAP_METHOD(getLyric, getLyric:(NSString *)path resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  AVURLAsset *asset = [AVURLAsset URLAssetWithURL:MediaURL(path) options:nil];
  resolve(MetadataString(asset, @[@"lyric", @"lyrics", @"uslt"]));
}

RCT_REMAP_METHOD(getMediaTag, getMediaTag:(NSString *)path resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  NSMutableDictionary *metadata = [ReadBasicMetadata(path) mutableCopy];
  AVURLAsset *asset = [AVURLAsset URLAssetWithURL:MediaURL(path) options:nil];
  metadata[@"lyric"] = MetadataString(asset, @[@"lyric", @"lyrics", @"uslt"]);
  metadata[@"comment"] = MetadataString(asset, @[@"comment", @"comm"]);
  resolve(metadata);
}

RCT_REMAP_METHOD(setMediaTag, setMediaTag:(NSString *)path metadata:(NSDictionary *)metadata resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  reject(@"unsupported", @"Editing embedded audio tags is not supported on iOS", nil);
}

@end
