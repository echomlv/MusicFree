#import <AVFoundation/AVFoundation.h>
#import <React/RCTBridgeModule.h>
#import <XCTest/XCTest.h>
#import <SDWebImage/SDImageCache.h>

@interface NSObject (MusicFreeMetadataTests)
- (void)getBasicMeta:(NSString *)path resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject;
- (void)getMediaMeta:(NSArray<NSString *> *)paths resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject;
@end

@interface MusicFreeTests : XCTestCase
@end

@implementation MusicFreeTests

- (void)testImageCachePolicyIsEnabledAtLaunch {
  SDImageCacheConfig *config = SDImageCache.sharedImageCache.config;
  XCTAssertEqual(config.maxDiskSize, 100u * 1024 * 1024);
  XCTAssertEqual(config.maxDiskAge, 7 * 24 * 60 * 60);
  XCTAssertTrue(config.shouldRemoveExpiredDataWhenEnterBackground);
}

- (SDImageCache *)isolatedImageCache {
  SDImageCacheConfig *config = [SDImageCache.sharedImageCache.config copy];
  // Exercise the production eviction algorithm with small, isolated fixtures.
  config.maxDiskSize = 128 * 1024;
  return [[SDImageCache alloc] initWithNamespace:NSUUID.UUID.UUIDString
                            diskCacheDirectory:NSTemporaryDirectory()
                                        config:config];
}

- (void)cleanImageCacheAndWait:(SDImageCache *)cache {
  XCTestExpectation *cleaned = [self expectationWithDescription:@"Image cache cleanup completed"];
  [cache deleteOldFilesWithCompletionBlock:^{ [cleaned fulfill]; }];
  [self waitForExpectations:@[cleaned] timeout:5];
}

- (void)testImageCacheKeepsRecentEntriesBelowLimit {
  SDImageCache *cache = [self isolatedImageCache];
  [cache.diskCache setData:[NSMutableData dataWithLength:16 * 1024] forKey:@"recent"];
  [self cleanImageCacheAndWait:cache];
  XCTAssertTrue([cache.diskCache containsDataForKey:@"recent"]);
  [[NSFileManager defaultManager] removeItemAtPath:cache.diskCachePath error:nil];
}

- (void)testImageCacheExpiresOldEntriesWithoutClearingMemoryOrOtherFiles {
  SDImageCache *cache = [self isolatedImageCache];
  NSFileManager *files = NSFileManager.defaultManager;
  NSString *localImage = [NSTemporaryDirectory() stringByAppendingPathComponent:NSUUID.UUID.UUIDString];
  NSData *data = [NSMutableData dataWithLength:16 * 1024];
  [data writeToFile:localImage atomically:YES];
  [cache.diskCache setData:data forKey:@"old"];
  [cache.diskCache setData:data forKey:@"recent"];
  UIImage *displayedImage = [UIImage new];
  [cache.memoryCache setObject:displayedImage forKey:@"old"];
  NSError *error = nil;
  [files setAttributes:@{NSFileModificationDate: [NSDate dateWithTimeIntervalSinceNow:-8 * 24 * 60 * 60]}
          ofItemAtPath:[cache cachePathForKey:@"old"] error:&error];
  XCTAssertNil(error);
  [self cleanImageCacheAndWait:cache];
  XCTAssertFalse([cache.diskCache containsDataForKey:@"old"]);
  XCTAssertTrue([cache.diskCache containsDataForKey:@"recent"]);
  XCTAssertEqual([cache.memoryCache objectForKey:@"old"], displayedImage);
  XCTAssertTrue([files fileExistsAtPath:localImage]);
  [files removeItemAtPath:cache.diskCachePath error:nil];
  [files removeItemAtPath:localImage error:nil];
}

- (void)testOversizedImageCacheTrimsOldestEntriesAndKeepsNewest {
  SDImageCache *cache = [self isolatedImageCache];
  for (NSUInteger index = 0; index < 4; index++) {
    NSString *key = [NSString stringWithFormat:@"image-%lu", (unsigned long)index];
    [cache.diskCache setData:[NSMutableData dataWithLength:48 * 1024] forKey:key];
    NSError *error = nil;
    [NSFileManager.defaultManager setAttributes:@{NSFileModificationDate: [NSDate dateWithTimeIntervalSinceNow:-(double)(4 - index) * 60]}
                                  ofItemAtPath:[cache cachePathForKey:key] error:&error];
    XCTAssertNil(error);
  }
  [self cleanImageCacheAndWait:cache];
  XCTAssertFalse([cache.diskCache containsDataForKey:@"image-0"]);
  XCTAssertTrue([cache.diskCache containsDataForKey:@"image-3"]);
  XCTAssertLessThanOrEqual(cache.diskCache.totalSize, cache.config.maxDiskSize / 2);
  [NSFileManager.defaultManager removeItemAtPath:cache.diskCachePath error:nil];
}

- (NSURL *)createAudioFixture {
  NSURL *url = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:[NSUUID.UUID.UUIDString stringByAppendingPathExtension:@"wav"]]];
  AVAudioFormat *format = [[AVAudioFormat alloc] initStandardFormatWithSampleRate:44100 channels:1];
  NSError *error = nil;
  AVAudioFile *file = [[AVAudioFile alloc] initForWriting:url settings:format.settings error:&error];
  XCTAssertNil(error);
  AVAudioPCMBuffer *buffer = [[AVAudioPCMBuffer alloc] initWithPCMFormat:format frameCapacity:22050];
  buffer.frameLength = 22050;
  memset(buffer.floatChannelData[0], 0, 22050 * sizeof(float));
  [file writeFromBuffer:buffer error:&error];
  XCTAssertNil(error);
  return url;
}

- (void)testMetadataReportsMillisecondsForFileURLs {
  NSURL *url = [self createAudioFixture];
  id module = [[NSClassFromString(@"Mp3Util") alloc] init];
  XCTAssertNotNil(module);
  [module getBasicMeta:url.absoluteString resolver:^(NSDictionary *metadata) {
    XCTAssertEqualWithAccuracy([metadata[@"duration"] doubleValue], 500, 2);
    XCTAssertTrue([metadata[@"title"] length] > 0);
  } rejecter:^(NSString *code, NSString *message, NSError *error) {
    XCTFail(@"Metadata failed: %@ %@", code, message);
  }];
  [[NSFileManager defaultManager] removeItemAtURL:url error:nil];
}

- (void)testBatchMetadataKeepsMissingFilePositions {
  NSURL *url = [self createAudioFixture];
  id module = [[NSClassFromString(@"Mp3Util") alloc] init];
  XCTAssertNotNil(module);
  [module getMediaMeta:@[@"/does-not-exist.mp3", url.path] resolver:^(NSArray *metadata) {
    XCTAssertEqual(metadata.count, 2u);
    XCTAssertEqualObjects(metadata[0], NSNull.null);
    XCTAssertEqualWithAccuracy([metadata[1][@"duration"] doubleValue], 500, 2);
  } rejecter:^(NSString *code, NSString *message, NSError *error) {
    XCTFail(@"Batch metadata failed: %@ %@", code, message);
  }];
  [[NSFileManager defaultManager] removeItemAtURL:url error:nil];
}

@end
