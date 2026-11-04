#import <Photos/Photos.h>
#import <React/RCTBridgeModule.h>

@interface MediaLibrary : NSObject <RCTBridgeModule>
@end

@implementation MediaLibrary
RCT_EXPORT_MODULE();
+ (BOOL)requiresMainQueueSetup { return NO; }

RCT_REMAP_METHOD(saveImage, saveImage:(NSString *)path resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [PHPhotoLibrary requestAuthorizationForAccessLevel:PHAccessLevelAddOnly handler:^(PHAuthorizationStatus status) {
    if (status != PHAuthorizationStatusAuthorized && status != PHAuthorizationStatusLimited) {
      reject(@"photo_permission_denied", @"Please allow MusicFree to add photos in Settings", nil);
      return;
    }
    __block NSString *identifier;
    [[PHPhotoLibrary sharedPhotoLibrary] performChanges:^{
      PHAssetChangeRequest *request = [PHAssetChangeRequest creationRequestForAssetFromImageAtFileURL:[NSURL fileURLWithPath:path]];
      identifier = request.placeholderForCreatedAsset.localIdentifier;
    } completionHandler:^(BOOL success, NSError *error) {
      if (success) resolve([@"ph://" stringByAppendingString:identifier ?: @""]);
      else reject(@"photo_save_failed", error.localizedDescription ?: @"Unable to save image", error);
    }];
  }];
}
@end
