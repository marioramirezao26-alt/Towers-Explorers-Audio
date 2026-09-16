import SwiftUI

/// Bienvenida de Gaby, la primera vez que se abre la app.
///
/// Reemplaza el recorrido de 4 pantallas que traía Scowld, que no servía aquí:
/// mostraba su logo (un archivo que no se copió, por licencia, y quedaba un
/// cuadro vacío), un carrusel de videos que tampoco se copió, y una pantalla
/// legal que pedía aceptar la política de privacidad y los términos de
/// scowld.xyz — documentos de otra empresa, que no rigen esta app.
struct StartupOnboardingView: View {
    let onComplete: () -> Void

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                VStack(spacing: 28) {
                    VStack(spacing: 12) {
                        Text("Hola, soy Gaby")
                            .font(.system(size: 42, weight: .bold, design: .rounded))
                            .multilineTextAlignment(.center)
                            .minimumScaleFactor(0.72)

                        Text("Tu asistente. Háblame o escríbeme, y me encargo.")
                            .font(.headline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .lineSpacing(3)
                    }

                    VStack(spacing: 12) {
                        OnboardingFeatureRow(
                            icon: "calendar",
                            title: "Tus citas",
                            subtitle: "\"Agéndame el martes a las 3\"."
                        )
                        OnboardingFeatureRow(
                            icon: "waveform",
                            title: "Tus notas de voz",
                            subtitle: "Las guardo y te las transcribo."
                        )
                        OnboardingFeatureRow(
                            icon: "arrow.triangle.2.circlepath",
                            title: "En todos lados",
                            subtitle: "Lo mismo que ves en la web."
                        )
                    }
                }
                .padding(22)
                .frame(maxWidth: UIDevice.current.userInterfaceIdiom == .pad ? 640 : .infinity)

                Spacer()

                Button(action: onComplete) {
                    HStack {
                        Text("Empezar")
                            .font(.headline)
                        Spacer()
                        Image(systemName: "arrow.right.circle.fill")
                            .font(.title3)
                    }
                    .padding(.horizontal, 18)
                    .frame(height: 54)
                    .foregroundStyle(.black)
                    .background(Color.amicaBlue, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 22)
                .padding(.bottom, 20)
            }
        }
    }
}

private struct OnboardingFeatureRow: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.title3.weight(.bold))
                .foregroundStyle(Color.amicaBlue)
                .frame(width: 46, height: 46)
                .background(.white.opacity(0.08), in: Circle())

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
        .padding(15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(.white.opacity(0.08), lineWidth: 1)
        }
    }
}
