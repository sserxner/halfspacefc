#import <AppKit/AppKit.h>
#import <CoreImage/CoreImage.h>
#import <Vision/Vision.h>

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc != 3) {
            fprintf(stderr, "Usage: person-cutout input output\n");
            return 2;
        }

        NSURL *inputURL = [NSURL fileURLWithPath:[NSString stringWithUTF8String:argv[1]]];
        NSURL *outputURL = [NSURL fileURLWithPath:[NSString stringWithUTF8String:argv[2]]];
        CIImage *source = [CIImage imageWithContentsOfURL:inputURL];
        if (!source) return 3;

        VNGeneratePersonSegmentationRequest *request = [VNGeneratePersonSegmentationRequest new];
        request.qualityLevel = VNGeneratePersonSegmentationRequestQualityLevelAccurate;
        request.outputPixelFormat = kCVPixelFormatType_OneComponent8;

        VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCIImage:source options:@{}];
        NSError *error = nil;
        if (![handler performRequests:@[request] error:&error]) {
            fprintf(stderr, "%s\n", error.localizedDescription.UTF8String);
            return 4;
        }

        VNPixelBufferObservation *observation = request.results.firstObject;
        if (!observation) return 5;

        CIImage *mask = [CIImage imageWithCVPixelBuffer:observation.pixelBuffer];
        CGRect extent = source.extent;
        CGFloat sx = CGRectGetWidth(extent) / CGRectGetWidth(mask.extent);
        CGFloat sy = CGRectGetHeight(extent) / CGRectGetHeight(mask.extent);
        mask = [[mask imageByApplyingTransform:CGAffineTransformMakeScale(sx, sy)] imageByCroppingToRect:extent];

        CIImage *clear = [[CIImage imageWithColor:[CIColor clearColor]] imageByCroppingToRect:extent];
        CIFilter *blend = [CIFilter filterWithName:@"CIBlendWithMask"];
        [blend setValue:source forKey:kCIInputImageKey];
        [blend setValue:clear forKey:kCIInputBackgroundImageKey];
        [blend setValue:mask forKey:kCIInputMaskImageKey];

        CIContext *context = [CIContext contextWithOptions:@{}];
        CGColorSpaceRef colorSpace = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
        NSData *png = [context PNGRepresentationOfImage:blend.outputImage
                                                 format:kCIFormatRGBA8
                                             colorSpace:colorSpace
                                                options:@{}];
        CGColorSpaceRelease(colorSpace);
        if (!png || ![png writeToURL:outputURL options:NSDataWritingAtomic error:&error]) {
            fprintf(stderr, "%s\n", error.localizedDescription.UTF8String);
            return 6;
        }
    }
    return 0;
}
