import Foundation
import UIKit

/// Habla directo con el backend de Gaby (Firebase Cloud Functions) — la misma
/// función `deviceCommand` que ya usa el Stack-chan (ver stackchan-firmware/ en
/// la raíz del repo). No usa el SDK de Firebase ni sus proveedores de IA propios
/// (`AI/`, `AIProvider`): es una llamada HTTPS simple con un secreto compartido,
/// igual que el firmware del Stack-chan — evita meter Firebase Auth solo para
/// esto. El router local (agendar/anotar) y el resto de la lógica de negocio
/// viven del lado del servidor; este cliente solo manda texto y recibe texto.
struct GabyBackendClient {
    enum ClientError: LocalizedError {
        case notConfigured
        case badResponse(statusCode: Int, body: String)
        case invalidResponse

        var errorDescription: String? {
            switch self {
            case .notConfigured:
                "Falta configurar GabySecrets (endpoint, secreto de dispositivo, workspaceId) — ver Secrets.swift.example."
            case let .badResponse(statusCode, body):
                "El backend de Gaby respondió \(statusCode): \(body)"
            case .invalidResponse:
                "Respuesta inesperada del backend de Gaby."
            }
        }
    }

    private struct RequestBody: Encodable {
        let workspaceId: String
        let message: String
    }

    private struct ResponseBody: Decodable {
        let reply: String
    }

    var endpoint: URL
    var deviceSharedSecret: String
    var workspaceId: String

    /// Manda `message` a Gaby y devuelve su respuesta en texto — resuelto por el
    /// router local del lado del servidor o, si no lo reconoce, por OpenAI.
    func sendCommand(_ message: String) async throws -> String {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(deviceSharedSecret, forHTTPHeaderField: "x-device-secret")
        request.httpBody = try JSONEncoder().encode(RequestBody(workspaceId: workspaceId, message: message))

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ClientError.invalidResponse
        }
        guard httpResponse.statusCode == 200 else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw ClientError.badResponse(statusCode: httpResponse.statusCode, body: body)
        }
        return try JSONDecoder().decode(ResponseBody.self, from: data).reply
    }
}

/// Gaby entra a la app como un proveedor más (los de `AI/`), así que toda la UI
/// —chat, voz, avatar— la usa sin cambios. La diferencia es que no lleva clave de
/// API en el dispositivo: el backend decide qué modelo usar y qué herramientas
/// correr (agendar, anotar), igual que en la web y en el Stack-chan.
extension GabyBackendClient: LLMProvider {
    func generate(messages: [ChatMessage], systemPrompt _: String) async throws -> String {
        // El prompt de sistema (la personalidad de Gaby) vive del lado del
        // servidor, así que solo se manda el último turno del usuario: el
        // historial también lo lleva el backend, por workspace.
        guard let lastUserMessage = messages.last(where: { $0.role == .user })?.content else {
            throw ClientError.invalidResponse
        }
        return try await sendCommand(lastUserMessage)
    }

    func generateWithVision(messages: [ChatMessage], systemPrompt: String, image _: UIImage) async throws -> String {
        // `deviceCommand` todavía no recibe imágenes — se responde solo con el
        // texto en vez de fallar, que es lo que le sirve al usuario.
        try await generate(messages: messages, systemPrompt: systemPrompt)
    }
}

extension GabyBackendClient {
    /// Se arma desde `GabySecrets` (ver Secrets.swift.example) — `nil` si todavía
    /// no se configuró.
    static var configured: GabyBackendClient? {
        guard
            let url = URL(string: GabySecrets.deviceCommandEndpoint),
            !GabySecrets.deviceSharedSecret.isEmpty,
            !GabySecrets.workspaceId.isEmpty
        else {
            return nil
        }
        return GabyBackendClient(
            endpoint: url,
            deviceSharedSecret: GabySecrets.deviceSharedSecret,
            workspaceId: GabySecrets.workspaceId
        )
    }
}
