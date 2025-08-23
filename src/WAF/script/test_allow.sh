#!/bin/bash

TARGET_URL="https://localhost/"
ALLOWED_COUNT=0
TOTAL_TESTS=0

run_test()
{
    local description="$1"
    local command_args="$2"
    local non_blocking_pattern="^(2..|3..|404)$" # 2xx, 3xx, ou 404 sont considérés comme non bloqués par le WAF
    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -n "Test: $description ... "
    # Ajout de l'option -k pour ignorer la vérification du certificat SSL
    # shellcheck disable=SC2086
    full_curl_output=$(eval curl -k -s -o /dev/null -w "%{http_code}" $command_args)

    if [[ "$full_curl_output" =~ ([0-9]{3})$ ]]; then
        http_code="${BASH_REMATCH[1]}"
    else
        http_code="$full_curl_output"
    fi

    if [[ "$http_code" =~ $non_blocking_pattern ]]; then
        echo "AUTORISÉ ($http_code) - SUCCÈS"
        ALLOWED_COUNT=$((ALLOWED_COUNT + 1))
    else
        echo "BLOQUÉ/ERREUR ($http_code) - ÉCHEC (Possible Faux Positif si 403)"
        echo "   Commande: curl -k $command_args" # Ajout de -k pour l'affichage de la commande
    fi
    echo "-----------------------------------------------------------------"
}

# --- Requêtes GET simples ---
run_test "GET /" "\"${TARGET_URL}\""
run_test "GET /index.html (s'attend à 404 si non existant, mais pas 403)" "\"${TARGET_URL}index.html\""
run_test "GET avec paramètre simple" "\"${TARGET_URL}?name=test\""
run_test "GET avec plusieurs paramètres" "\"${TARGET_URL}?name=test&version=1.0&status=active\""
run_test "GET avec paramètres contenant des chiffres et des lettres" "\"${TARGET_URL}?id=user123&session=abc987xyz\""
run_test "GET avec paramètre contenant des espaces (encodés)" "\"${TARGET_URL}?query=hello%20world\""
run_test "GET avec paramètre contenant des caractères spéciaux courants (non malveillants)" "\"${TARGET_URL}?email=test@example.com&message=Hello-World_123!\""

# --- Requêtes POST simples ---
run_test "POST simple (form-urlencoded)" "-X POST -d \"name=John Doe&age=30\" \"${TARGET_URL}submit\""
run_test "POST simple (JSON)" "-X POST -H \"Content-Type: application/json\" -d '{\"item\":\"test\", \"value\":100}' \"${TARGET_URL}api/data\""

# --- User-Agents courants ---
run_test "User-Agent (Chrome)" "-A \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36\" \"${TARGET_URL}\""
run_test "User-Agent (Firefox)" "-A \"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:88.0) Gecko/20100101 Firefox/88.0\" \"${TARGET_URL}\""

# --- Chemins avec des caractères courants ---
run_test "Path avec tirets et underscores" "\"${TARGET_URL}some-path/another_file.txt\""
run_test "Path avec chiffres" "\"${TARGET_URL}api/v1/resource/123\""

# --- Requêtes pour des types de fichiers courants (attend 404 si non existant) ---
run_test "GET /styles.css" "\"${TARGET_URL}styles.css\""
run_test "GET /script.js" "\"${TARGET_URL}script.js\""
run_test "GET /image.png" "\"${TARGET_URL}image.png\""

echo "Nombre total de tests: $TOTAL_TESTS"
echo "Nombre de requêtes autorisées (ou non bloquées par WAF): $ALLOWED_COUNT"