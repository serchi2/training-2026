{ pkgs, ... }: {
  channel = "stable-24.11";
  
  packages = [
    pkgs.nodejs_22
    pkgs.sqlite          # Quitamos el ".bin" y la coma anterior.
    pkgs.firebase-tools  # ¡Agregado! Imprescindible si es un proyecto Firebase.
  ];
  
  env = {};
  
  idx = {
    extensions = [
      "google.gemini-cli-vscode-ide-companion"
      # "toba.vsfire" # (Opcional) Extensión útil para coloreado de sintaxis de reglas de Firebase
    ];
    
    workspace = {
      onCreate = {
        # Nota: 'npm ci' requiere que tengas un archivo package-lock.json en tu repo.
        # Si no lo tienes, cámbialo a 'npm install'
        npm-install = "npm ci --no-audit --prefer-offline --no-progress --timing";
      };
    };
    
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npm" "run" "dev" "--" "--port" "$PORT"];
          manager = "web";
        };
      };
    };
  };
}