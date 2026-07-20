import AppKit
import CoreImage
import Vision

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: foreground-cutout input output\n", stderr)
    exit(2)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])

guard let source = CIImage(contentsOf: inputURL) else {
    fputs("Could not read input image\n", stderr)
    exit(3)
}

if #available(macOS 14.0, *) {
    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(ciImage: source, options: [:])
    try handler.perform([request])

    guard let observation = request.results?.first else {
        fputs("No foreground mask generated\n", stderr)
        exit(4)
    }

    let maskBuffer = try observation.generateScaledMaskForImage(
        forInstances: observation.allInstances,
        from: handler
    )
    let mask = CIImage(cvPixelBuffer: maskBuffer).cropped(to: source.extent)
    let clear = CIImage(color: .clear).cropped(to: source.extent)
    let output = source.applyingFilter(
        "CIBlendWithMask",
        parameters: [
            kCIInputBackgroundImageKey: clear,
            kCIInputMaskImageKey: mask
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
} else {
    fputs("Foreground cutout requires macOS 14 or later\n", stderr)
    exit(6)
}
