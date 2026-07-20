import AppKit
import CoreImage
import Vision

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: person-cutout input output\n", stderr)
    exit(2)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])

guard let source = CIImage(contentsOf: inputURL) else {
    fputs("Could not read input image\n", stderr)
    exit(3)
}

let request = VNGeneratePersonSegmentationRequest()
request.qualityLevel = .accurate
request.outputPixelFormat = kCVPixelFormatType_OneComponent8

let handler = VNImageRequestHandler(ciImage: source, options: [:])
try handler.perform([request])

guard let observation = request.results?.first else {
    fputs("No person mask generated\n", stderr)
    exit(4)
}

let mask = CIImage(cvPixelBuffer: observation.pixelBuffer)
let scaleX = source.extent.width / mask.extent.width
let scaleY = source.extent.height / mask.extent.height
let scaledMask = mask.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))
    .cropped(to: source.extent)

let clear = CIImage(color: .clear).cropped(to: source.extent)
let output = source.applyingFilter(
    "CIBlendWithMask",
    parameters: [
        kCIInputBackgroundImageKey: clear,
        kCIInputMaskImageKey: scaledMask
    ]
)

let context = CIContext(options: [.useSoftwareRenderer: false])
let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
guard let data = context.pngRepresentation(
    of: output,
    format: .RGBA8,
    colorSpace: colorSpace
) else {
    fputs("Could not encode output PNG\n", stderr)
    exit(5)
}
try data.write(to: outputURL)
