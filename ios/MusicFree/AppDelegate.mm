#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>

// Files opened from iCloud Drive or another app must outlive that provider's access grant.
static NSURL *ImportDocumentURL(NSURL *url) {
  if (!url.isFileURL) return url;
  NSString *documents = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES).firstObject;
  if ([url.path hasPrefix:[documents stringByAppendingString:@"/"]]) return url;
  BOOL accessing = [url startAccessingSecurityScopedResource];
  NSString *directory = [[documents stringByAppendingPathComponent:@"imported_music"] stringByAppendingPathComponent:NSUUID.UUID.UUIDString];
  NSFileManager *files = [NSFileManager defaultManager];
  NSError *error = nil;
  [files createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:nil error:&error];
  NSString *filename = url.lastPathComponent;
  NSURL *target = [NSURL fileURLWithPath:[directory stringByAppendingPathComponent:filename]];
  BOOL copied = !error && [files copyItemAtURL:url toURL:target error:&error];
  if (accessing) [url stopAccessingSecurityScopedResource];
  return copied ? target : nil;
}

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"MusicFree";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  NSURL *launchURL = launchOptions[UIApplicationLaunchOptionsURLKey];
  if (launchURL.isFileURL) {
    NSMutableDictionary *options = [launchOptions mutableCopy];
    options[UIApplicationLaunchOptionsURLKey] = ImportDocumentURL(launchURL);
    launchOptions = options;
  }
  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (BOOL)application:(UIApplication *)application openURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options
{
  url = ImportDocumentURL(url);
  if (!url) return NO;
  BOOL handledByExpo = [super application:application openURL:url options:options];
  return [RCTLinkingManager application:application openURL:url options:options] || handledByExpo;
}

- (BOOL)application:(UIApplication *)application continueUserActivity:(NSUserActivity *)userActivity restorationHandler:(void (^)(NSArray<id<UIUserActivityRestoring>> *))restorationHandler
{
  BOOL handledByExpo = [super application:application continueUserActivity:userActivity restorationHandler:restorationHandler];
  return [RCTLinkingManager application:application continueUserActivity:userActivity restorationHandler:restorationHandler] || handledByExpo;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@".expo/.virtual-metro-entry"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
