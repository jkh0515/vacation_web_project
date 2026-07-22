package com.vacation.judge.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vacation.judge.config.RabbitMQConfig;
import com.vacation.judge.domain.Problem;
import com.vacation.judge.domain.Submission;
import com.vacation.judge.domain.User;
import com.vacation.judge.dto.SubmissionMessageDto;
import com.vacation.judge.dto.SubmissionRequestDto;
import com.vacation.judge.repository.ProblemRepository;
import com.vacation.judge.repository.SubmissionRepository;
import com.vacation.judge.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class SubmissionService implements MessageListener {

    private final SubmissionRepository submissionRepository;
    private final UserRepository userRepository;
    private final ProblemRepository problemRepository;
    private final RabbitTemplate rabbitTemplate;
    private final RedisMessageListenerContainer redisMessageListenerContainer;
    private final ObjectMapper objectMapper;

    private final Map<Long, SseEmitter> emitters = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        redisMessageListenerContainer.addMessageListener(this, new ChannelTopic("judge_events"));
    }

    @Transactional
    public Long submitCode(SubmissionRequestDto requestDto) {
        User user = userRepository.findById(requestDto.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Problem problem = problemRepository.findById(requestDto.getProblemId())
                .orElseThrow(() -> new IllegalArgumentException("Problem not found"));

        Submission submission = new Submission(user, problem, requestDto.getCode(), requestDto.getLanguage());
        submissionRepository.save(submission);

        SubmissionMessageDto messageDto = new SubmissionMessageDto(
                submission.getId(),
                submission.getCode(),
                submission.getLanguage(),
                "10 10\n", // mock input data for now
                2
        );

        rabbitTemplate.convertAndSend(RabbitMQConfig.QUEUE_NAME, messageDto);
        log.info("Published submission {} to RabbitMQ", submission.getId());

        return submission.getId();
    }

    public SseEmitter subscribe(Long submissionId) {
        SseEmitter emitter = new SseEmitter(60 * 1000L); // 60 seconds timeout
        emitters.put(submissionId, emitter);

        emitter.onCompletion(() -> emitters.remove(submissionId));
        emitter.onTimeout(() -> emitters.remove(submissionId));
        emitter.onError((e) -> emitters.remove(submissionId));

        try {
            emitter.send(SseEmitter.event().name("connect").data("Connected to submission " + submissionId));
        } catch (IOException e) {
            emitters.remove(submissionId);
        }

        return emitter;
    }

    @Override
    @Transactional
    public void onMessage(Message message, byte[] pattern) {
        try {
            String body = new String(message.getBody());
            log.info("Received message from Redis: {}", body);
            JsonNode jsonNode = objectMapper.readTree(body);

            Long submissionId = jsonNode.get("submission_id").asLong();
            String status = jsonNode.get("status").asText();
            String output = jsonNode.get("output").asText();

            // Update DB
            submissionRepository.findById(submissionId).ifPresent(submission -> {
                submission.setStatus(status);
                submission.setResultOutput(output);
                submissionRepository.save(submission);
            });

            // Notify SSE
            SseEmitter emitter = emitters.get(submissionId);
            if (emitter != null) {
                emitter.send(SseEmitter.event().name("judge_result").data(body));
                emitter.complete();
            }

        } catch (Exception e) {
            log.error("Error processing redis message", e);
        }
    }
}
