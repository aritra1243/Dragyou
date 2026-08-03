#pragma once
// =============================================================================
//  nova CLI — Tiny HTTP Client & Repository Helpers
// =============================================================================

#include "repository.h"

#include <string>
#include <vector>

struct HttpResponse {
    int         status = 0;
    std::string body;
};

// Synchronous HTTP POST request
HttpResponse http_post(const std::string& url,
                       const std::string& bearer_token,
                       const std::vector<uint8_t>& body,
                       const std::string& content_type = "application/octet-stream");

// Like http_post but also sends X-Dragyou-Ref and X-Dragyou-Tip headers
// so the server can update the branch ref after applying a pack.
HttpResponse http_post_with_ref(const std::string& url,
                                const std::string& bearer_token,
                                const std::vector<uint8_t>& body,
                                const std::string& content_type,
                                const std::string& ref,
                                const std::string& tip);

// Helper JSON parser/formatter utilities
std::string json_array(const std::vector<std::string>& items);
std::vector<std::string> parse_json_string_array(const std::string& json, const std::string& key);

// Remote repo & credentials helpers
std::string get_remote_url(const dragyou::Repository& repo, const std::string& remote_name);
std::string get_token(const dragyou::Repository& repo);
