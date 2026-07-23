package com.vacation.judge.service;

import com.vacation.judge.dto.AiHintRequestDto;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.util.Map;
import java.util.HashMap;

@Service
public class AiService {
    @Value("${app.ai-server.url}")
    private String AI_SERVER_URL;
    private final RestTemplate restTemplate = new RestTemplate();

    public String getHint(AiHintRequestDto request) {
        String url = AI_SERVER_URL + "/hint";
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        
        Map<String, String> body = new HashMap<>();
        body.put("problem_text", request.getProblemText());
        body.put("failed_code", request.getFailedCode());
        
        HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);
        
        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
            if (response.getBody() != null && response.getBody().containsKey("hint")) {
                return (String) response.getBody().get("hint");
            }
        } catch (Exception e) {
            return "AI 서버 연결에 실패했습니다: " + e.getMessage();
        }
        return "AI 응답을 가져오지 못했습니다.";
    }
}
