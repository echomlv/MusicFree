#import <AVFoundation/AVFoundation.h>
#import <React/RCTBridgeModule.h>
#import <XCTest/XCTest.h>

@interface NSObject (MusicFreeMetadataTests)
- (void)getBasicMeta:(NSString *)path resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject;
- (void)getMediaMeta:(NSArray<NSString *> *)paths resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject;
@end

@interface MusicFreeTests : XCTestCase
@end

@implementation MusicFreeTests

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
