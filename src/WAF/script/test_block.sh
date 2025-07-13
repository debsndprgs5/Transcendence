#!/bin/bash

TARGET_URL="https://localhost/"
BLOCKED_COUNT=0
TOTAL_TESTS=0

run_test() {
    local description="$1"
    local command_args="$2"
    local expected_pattern="^403$"
    if [ -n "$3" ]; then
        expected_pattern="$3"
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -n "Test: $description ... "
    # shellcheck disable=SC2086
    full_curl_output=$(eval curl -k -s -o /dev/null -w "%{http_code}" $command_args)

    if [[ "$full_curl_output" =~ ([0-9]{3})$ ]]; then
        http_code="${BASH_REMATCH[1]}"
    else
        http_code="$full_curl_output"
    fi

    if [[ "$http_code" =~ $expected_pattern ]]; then
        echo "BLOQUÉ/REFUSÉ ($http_code) - SUCCÈS"
        BLOCKED_COUNT=$((BLOCKED_COUNT + 1))
    else
        echo "NON BLOQUÉ ($http_code) - ÉCHEC"
        echo "   Commande: curl -k $command_args" # Ajout de -k pour l'affichage de la commande
        echo "   Attendu (pattern): $expected_pattern, Reçu: $http_code"
    fi
    echo "-----------------------------------------------------------------"
}

# --- Tests d'Injection SQL ---
run_test "Injection SQL (simple)" "\"${TARGET_URL}?id=1%20OR%201=1\""
run_test "Injection SQL (UNION)" "\"${TARGET_URL}?id=1%20UNION%20SELECT%20@@version,null,null%20--\""
run_test "Injection SQL (commentaire)" "\"${TARGET_URL}?param=select%20*%20from%20users%20where%20id%3D'admin'--'\""
run_test "Injection SQL (dans User-Agent)" "-A \"sqlmap/1.5\" \"${TARGET_URL}\""
run_test "Injection SQL (dans Cookie)" "--cookie \"sessionid=123' OR '1'='1\" \"${TARGET_URL}\""

# --- Tests XSS (Cross-Site Scripting) ---
run_test "XSS (simple script tag)" "\"${TARGET_URL}?query=<script>alert('XSS')</script>\""
run_test "XSS (img onerror)" "\"${TARGET_URL}?name=<img%20src=x%20onerror=alert(1)>\""
run_test "XSS (encodé)" "\"${TARGET_URL}?data=%253Cscript%253Ealert(1)%253C%252Fscript%253E\""
run_test "XSS (dans le path)" "\"${TARGET_URL}foo<script>alert(1)</script>bar\""

# --- Tests LFI/Path Traversal ---
run_test "LFI (etc/passwd)" "\"${TARGET_URL}?page=../../../../etc/passwd\""
run_test "LFI (avec null byte)" "\"${TARGET_URL}?file=../../../../etc/passwd%00\""
run_test "Path Traversal (simple)" "\"${TARGET_URL}../../boot.ini\""

# --- Tests d'Injection de Commande ---
run_test "Injection de Commande (simple)" "\"${TARGET_URL}?host=127.0.0.1;%20ls%20-la\""
run_test "Injection de Commande (avec pipe)" "\"${TARGET_URL}?target=google.com%20|%20cat%20/etc/hostname\""
run_test "Injection de Commande (backticks)" "\"${TARGET_URL}?cmd=%60id%60\""

# --- Tests d'Accès à des Fichiers/Extensions Restreints ---
run_test "Accès fichier .log" "\"${TARGET_URL}error.log\""
run_test "Accès fichier .bak" "\"${TARGET_URL}backup.bak\""
run_test "Accès fichier .git/config" "\"${TARGET_URL}.git/config\""
run_test "Accès fichier .DS_Store" "\"${TARGET_URL}.DS_Store\""

# --- Tests de User-Agents Malveillants ---
run_test "User-Agent (Nikto)" "-A \"Nikto/2.1.6\" \"${TARGET_URL}\""
run_test "User-Agent (ZmEu)" "-A \"ZmEu\" \"${TARGET_URL}\""
run_test "User-Agent (masscan)" "-A \"masscan/1.0\" \"${TARGET_URL}\""

# --- Tests de Protocoles/Méthodes ---
run_test "Méthode HTTP (TRACE)" "-X TRACE \"${TARGET_URL}\"" "^(403|405)$"
run_test "Injection CRLF dans Header" "-H \"X-Test: value%0d%0aInjected: header\" \"${TARGET_URL}\""

# --- Tests de Scanner ---
run_test "Requête typique de scanner (Acunetix)" "\"${TARGET_URL}acunetix-wvs-test-for-some-inexistent-file\""

# --- Tests de limites ---
run_test "Nombre excessif d'arguments" "\"${TARGET_URL}?a=1&b=2&c=3&d=4&e=5&f=6&g=7&h=8&i=9&j=10&k=11&l=12&m=13&n=14&o=15&p=16&q=17&r=18&s=19&t=20&u=21\""
run_test "Argument très long" "\"${TARGET_URL}?longparam=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 1024)\""


# --- Test de Limite de Taux (Rate Limiting / DoS Protection) ---
echo "Test: Limite de Taux (DoS Protection)"
TOTAL_TESTS=$((TOTAL_TESTS + 1))
RATE_LIMIT_TRIGGERED=false

for i in $(seq 1 50); do
    # shellcheck disable=SC2086
    eval curl -k -s -o /dev/null -w "%{http_code}" "\"${TARGET_URL}index.html?burst1=$i\"" > /dev/null
done

echo -n "   Vérification du blocage après les rafales ... "
http_code_after_burst=$(curl -k -s -o /dev/null -w "%{http_code}" "${TARGET_URL}index.html?afterburst=true")
if [[ "$http_code_after_burst" =~ ^(429|403)$ ]]; then # CRS DoS protection utilise souvent 429
    echo "BLOQUÉ ($http_code_after_burst) - SUCCÈS"
    BLOCKED_COUNT=$((BLOCKED_COUNT + 1))
    RATE_LIMIT_TRIGGERED=true
else
    echo "NON BLOQUÉ ($http_code_after_burst) - ÉCHEC"
    echo "      Attendu (pattern): ^(429|403)$, Reçu: $http_code_after_burst"
fi
echo "-----------------------------------------------------------------"


echo "Nombre total de tests: $TOTAL_TESTS"
echo "Nombre de requêtes bloquées/refusées (selon attente): $BLOCKED_COUNT"