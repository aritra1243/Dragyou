// =============================================================================
//  drag CLI — Tiny HTTP Client & Repository Helpers implementation
// =============================================================================

#include "http_client.h"

#include <filesystem>
#include <fstream>
#include <sstream>

#ifdef _WIN32
#include <windows.h>
#include <winhttp.h>
#pragma comment(lib, "winhttp.lib")
#else
#include <curl/curl.h>
#endif

namespace fs = std::filesystem;

HttpResponse http_post(const std::string& url,
                       const std::string& bearer_token,
                       const std::vector<uint8_t>& body,
                       const std::string& content_type) {
    HttpResponse resp;

#ifdef _WIN32
    URL_COMPONENTS uc{};
    uc.dwStructSize = sizeof(uc);
    wchar_t scheme[32], host[512], path[1024];
    uc.lpszScheme   = scheme;  uc.dwSchemeLength   = 32;
    uc.lpszHostName = host;    uc.dwHostNameLength = 512;
    uc.lpszUrlPath  = path;    uc.dwUrlPathLength  = 1024;
    std::wstring wurl(url.begin(), url.end());
    WinHttpCrackUrl(wurl.c_str(), 0, 0, &uc);

    HINTERNET session = WinHttpOpen(L"drag/0.1", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
                                    WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    HINTERNET conn    = WinHttpConnect(session, uc.lpszHostName, uc.nPort, 0);
    DWORD flags = (uc.nScheme == INTERNET_SCHEME_HTTPS) ? WINHTTP_FLAG_SECURE : 0;
    HINTERNET req     = WinHttpOpenRequest(conn, L"POST", uc.lpszUrlPath,
                                           nullptr, WINHTTP_NO_REFERER,
                                           WINHTTP_DEFAULT_ACCEPT_TYPES, flags);

    std::wstring auth_hdr = L"Authorization: Bearer " + std::wstring(bearer_token.begin(), bearer_token.end());
    std::wstring ct_hdr   = L"Content-Type: " + std::wstring(content_type.begin(), content_type.end());
    WinHttpAddRequestHeaders(req, auth_hdr.c_str(), -1L, WINHTTP_ADDREQ_FLAG_ADD);
    WinHttpAddRequestHeaders(req, ct_hdr.c_str(),   -1L, WINHTTP_ADDREQ_FLAG_ADD);

    WinHttpSendRequest(req, WINHTTP_NO_ADDITIONAL_HEADERS, 0,
                       const_cast<void*>(static_cast<const void*>(body.data())),
                       static_cast<DWORD>(body.size()),
                       static_cast<DWORD>(body.size()), 0);
    WinHttpReceiveResponse(req, nullptr);

    DWORD status_code = 0, size = sizeof(status_code);
    WinHttpQueryHeaders(req, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                        WINHTTP_HEADER_NAME_BY_INDEX, &status_code, &size,
                        WINHTTP_NO_HEADER_INDEX);
    resp.status = static_cast<int>(status_code);

    char buf[4096];
    DWORD read = 0;
    do {
        WinHttpReadData(req, buf, sizeof(buf), &read);
        resp.body.append(buf, read);
    } while (read > 0);

    WinHttpCloseHandle(req);
    WinHttpCloseHandle(conn);
    WinHttpCloseHandle(session);
#else
    CURL* curl = curl_easy_init();
    if (!curl) { resp.status = -1; return resp; }

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, ("Authorization: Bearer " + bearer_token).c_str());
    headers = curl_slist_append(headers, ("Content-Type: " + content_type).c_str());

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, static_cast<long>(body.size()));
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.data());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION,
        +[](char* ptr, size_t, size_t nmemb, void* ud) {
            static_cast<std::string*>(ud)->append(ptr, nmemb);
            return nmemb;
        });
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &resp.body);

    curl_easy_perform(curl);
    long code = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &code);
    resp.status = static_cast<int>(code);

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
#endif
    return resp;
}

HttpResponse http_post_with_ref(const std::string& url,
                                const std::string& bearer_token,
                                const std::vector<uint8_t>& body,
                                const std::string& content_type,
                                const std::string& ref,
                                const std::string& tip) {
    HttpResponse resp;

#ifdef _WIN32
    URL_COMPONENTS uc{};
    uc.dwStructSize = sizeof(uc);
    wchar_t scheme[32], host[512], path[1024];
    uc.lpszScheme   = scheme;  uc.dwSchemeLength   = 32;
    uc.lpszHostName = host;    uc.dwHostNameLength = 512;
    uc.lpszUrlPath  = path;    uc.dwUrlPathLength  = 1024;
    std::wstring wurl(url.begin(), url.end());
    WinHttpCrackUrl(wurl.c_str(), 0, 0, &uc);

    HINTERNET session = WinHttpOpen(L"drag/0.1", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
                                    WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    HINTERNET conn    = WinHttpConnect(session, uc.lpszHostName, uc.nPort, 0);
    DWORD flags = (uc.nScheme == INTERNET_SCHEME_HTTPS) ? WINHTTP_FLAG_SECURE : 0;
    HINTERNET req     = WinHttpOpenRequest(conn, L"POST", uc.lpszUrlPath,
                                           nullptr, WINHTTP_NO_REFERER,
                                           WINHTTP_DEFAULT_ACCEPT_TYPES, flags);

    std::wstring auth_hdr = L"Authorization: Bearer " + std::wstring(bearer_token.begin(), bearer_token.end());
    std::wstring ct_hdr   = L"Content-Type: "         + std::wstring(content_type.begin(), content_type.end());
    std::wstring ref_hdr  = L"X-Dragyou-Ref: "        + std::wstring(ref.begin(), ref.end());
    std::wstring tip_hdr  = L"X-Dragyou-Tip: "        + std::wstring(tip.begin(), tip.end());
    WinHttpAddRequestHeaders(req, auth_hdr.c_str(), -1L, WINHTTP_ADDREQ_FLAG_ADD);
    WinHttpAddRequestHeaders(req, ct_hdr.c_str(),   -1L, WINHTTP_ADDREQ_FLAG_ADD);
    WinHttpAddRequestHeaders(req, ref_hdr.c_str(),  -1L, WINHTTP_ADDREQ_FLAG_ADD);
    WinHttpAddRequestHeaders(req, tip_hdr.c_str(),  -1L, WINHTTP_ADDREQ_FLAG_ADD);

    WinHttpSendRequest(req, WINHTTP_NO_ADDITIONAL_HEADERS, 0,
                       const_cast<void*>(static_cast<const void*>(body.data())),
                       static_cast<DWORD>(body.size()),
                       static_cast<DWORD>(body.size()), 0);
    WinHttpReceiveResponse(req, nullptr);

    DWORD status_code = 0, size = sizeof(status_code);
    WinHttpQueryHeaders(req, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                        WINHTTP_HEADER_NAME_BY_INDEX, &status_code, &size,
                        WINHTTP_NO_HEADER_INDEX);
    resp.status = static_cast<int>(status_code);

    char buf[4096];
    DWORD read = 0;
    do {
        WinHttpReadData(req, buf, sizeof(buf), &read);
        resp.body.append(buf, read);
    } while (read > 0);

    WinHttpCloseHandle(req);
    WinHttpCloseHandle(conn);
    WinHttpCloseHandle(session);
#else
    CURL* curl = curl_easy_init();
    if (!curl) { resp.status = -1; return resp; }

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, ("Authorization: Bearer " + bearer_token).c_str());
    headers = curl_slist_append(headers, ("Content-Type: " + content_type).c_str());
    headers = curl_slist_append(headers, ("X-Dragyou-Ref: " + ref).c_str());
    headers = curl_slist_append(headers, ("X-Dragyou-Tip: " + tip).c_str());

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, static_cast<long>(body.size()));
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body.data());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION,
        +[](char* ptr, size_t, size_t nmemb, void* ud) {
            static_cast<std::string*>(ud)->append(ptr, nmemb);
            return nmemb;
        });
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &resp.body);

    curl_easy_perform(curl);
    long code = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &code);
    resp.status = static_cast<int>(code);

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
#endif
    return resp;
}

std::string json_array(const std::vector<std::string>& items) {
    std::string out = "[";
    for (size_t i = 0; i < items.size(); ++i) {
        if (i) out += ",";
        out += "\"" + items[i] + "\"";
    }
    return out + "]";
}

std::vector<std::string> parse_json_string_array(const std::string& json, const std::string& key) {
    std::vector<std::string> result;
    std::string search = "\"" + key + "\"";
    size_t pos = json.find(search);
    if (pos == std::string::npos) return result;
    pos = json.find('[', pos);
    if (pos == std::string::npos) return result;
    size_t end = json.find(']', pos);
    std::string arr = json.substr(pos + 1, end - pos - 1);
    std::istringstream iss(arr);
    std::string token;
    while (std::getline(iss, token, ',')) {
        size_t s = token.find('"');
        size_t e = token.rfind('"');
        if (s != std::string::npos && e > s)
            result.push_back(token.substr(s + 1, e - s - 1));
    }
    return result;
}

std::string get_remote_url(const dragyou::Repository& repo, const std::string& remote_name) {
    std::ifstream f(repo.config_path());
    std::string line, cur;
    while (std::getline(f, line)) {
        size_t s = line.find_first_not_of(" \t");
        if (s != std::string::npos) line = line.substr(s);
        if (line.rfind("[remote \"" + remote_name + "\"", 0) == 0) { cur = remote_name; continue; }
        if (!cur.empty() && line.rfind("url =", 0) == 0) {
            std::string url = line.substr(5);
            url.erase(0, url.find_first_not_of(" \t"));
            return url;
        }
        if (!cur.empty() && line[0] == '[') cur.clear();
    }
    return "";
}

std::string get_token(const dragyou::Repository& repo) {
    // Helper: read "token=..." from a credentials file
    auto read_token_from = [](const fs::path& cred_path) -> std::string {
        if (!fs::exists(cred_path)) return "";
        std::ifstream f(cred_path);
        std::string line;
        while (std::getline(f, line)) {
            if (line.rfind("token=", 0) == 0) return line.substr(6);
        }
        return "";
    };

    // 1. Try repo-local .drag/credentials first
    std::string tok = read_token_from(repo.drag() / "credentials");
    if (!tok.empty()) return tok;

    // 2. Fall back to global ~/.drag/credentials
    const char* home = std::getenv("USERPROFILE"); // Windows
    if (!home) home = std::getenv("HOME");          // Unix
    if (home) {
        tok = read_token_from(fs::path(home) / ".drag" / "credentials");
        if (!tok.empty()) return tok;
    }

    return "";
}
