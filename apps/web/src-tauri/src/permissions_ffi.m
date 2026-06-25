#import <Speech/Speech.h>
#import <dispatch/dispatch.h>

/// Request speech recognition access via SFSpeechRecognizer.
/// Blocks until the user responds to the system dialog (or timeout).
/// Returns SFSpeechRecognizerAuthorizationStatus as int32_t:
///   0=notDetermined, 1=denied, 2=restricted, 3=authorized
int32_t request_speech_recognition_access(void) {
    __block int32_t result = 0;
    dispatch_semaphore_t sema = dispatch_semaphore_create(0);

    [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus status) {
        result = (int32_t)status;
        dispatch_semaphore_signal(sema);
    }];

    dispatch_time_t timeout = dispatch_time(DISPATCH_TIME_NOW, 60 * NSEC_PER_SEC);
    dispatch_semaphore_wait(sema, timeout);
    return result;
}
