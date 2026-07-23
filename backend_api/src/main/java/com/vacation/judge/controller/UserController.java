package com.vacation.judge.controller;

import com.vacation.judge.domain.Submission;
import com.vacation.judge.repository.SubmissionRepository;
import com.vacation.judge.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final SubmissionRepository submissionRepository;

    @GetMapping("/me")
    public ResponseEntity<?> getMyProfile(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        Map<String, Object> profile = new HashMap<>();
        profile.put("email", userDetails.getUser().getEmail());
        profile.put("username", userDetails.getUser().getUsername());
        profile.put("role", userDetails.getUser().getRole().name());
        profile.put("createdAt", userDetails.getUser().getCreatedAt());
        return ResponseEntity.ok(profile);
    }

    @GetMapping("/me/submissions")
    public ResponseEntity<?> getMySubmissions(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        Long userId = userDetails.getUser().getId();
        
        List<Submission> submissions = submissionRepository.findByUserIdOrderByIdDesc(userId);
        
        List<Map<String, Object>> result = submissions.stream().map(sub -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", sub.getId());
            map.put("problemText", sub.getProblemText());
            map.put("language", sub.getLanguage());
            map.put("status", sub.getStatus());
            map.put("resultOutput", sub.getResultOutput());
            return map;
        }).collect(Collectors.toList());
        
        return ResponseEntity.ok(result);
    }

    @GetMapping("/me/submissions/latest")
    public ResponseEntity<?> getLatestSubmission(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }
        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        Long userId = userDetails.getUser().getId();
        
        List<Submission> submissions = submissionRepository.findByUserIdOrderByIdDesc(userId);
        if (submissions.isEmpty()) {
            return ResponseEntity.ok(Map.of("problemText", "", "code", "import sys\ndata = sys.stdin.read().strip().split()\nprint(int(data[0]) + int(data[1]))"));
        }
        
        Submission latest = submissions.get(0);
        return ResponseEntity.ok(Map.of(
            "problemText", latest.getProblemText(),
            "code", latest.getCode()
        ));
    }
}
