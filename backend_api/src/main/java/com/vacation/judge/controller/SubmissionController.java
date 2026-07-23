package com.vacation.judge.controller;

import com.vacation.judge.dto.SubmissionRequestDto;
import com.vacation.judge.service.SubmissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

@RestController
@RequestMapping("/api/submissions")
@RequiredArgsConstructor
public class SubmissionController {

    private final SubmissionService submissionService;

    @PostMapping
    public ResponseEntity<?> submitCode(@RequestBody SubmissionRequestDto requestDto, org.springframework.security.core.Authentication authentication) {
        try {
            if (authentication == null || !authentication.isAuthenticated()) {
                return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
            }
            String email = authentication.getName();
            // Fetch userId from DB or CustomUserDetails (assuming user is in CustomUserDetails)
            com.vacation.judge.security.CustomUserDetails userDetails = (com.vacation.judge.security.CustomUserDetails) authentication.getPrincipal();
            requestDto.setUserId(userDetails.getUser().getId());

            Long submissionId = submissionService.submitCode(requestDto);
            return ResponseEntity.ok(Map.of("submission_id", submissionId, "message", "Submission received"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/stream")
    public SseEmitter streamSubmissionResult(@PathVariable Long id) {
        return submissionService.subscribe(id);
    }
}
